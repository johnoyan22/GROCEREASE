<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\PaymentCheckoutAttempt;
use App\Services\PayMongoGateway;
use App\Services\PaymentCheckout;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\TransactionTestCase;

class SandboxPaymentTest extends TransactionTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        config(['payments.mode' => 'test', 'payments.merchants' => [$this->store->store_id => [
            'merchant_id' => 'org_storeA', 'secret_key' => 'sk_test_fixture', 'webhook_secret' => 'whsec_fixture', 'methods' => ['gcash', 'card'],
        ]]]);
        $this->store->forceFill(['paid_order_holding_hours' => 24])->save();
    }

    private function digitalCart(): array { return [...$this->cart(), 'payment_method' => 'digital', 'payment_channel' => 'wallet']; }
    private function digitalOrder(): Order
    {
        $cart = $this->digitalCart();
        $token = $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $cart)->assertOk()->json('quote_token');
        $id = $this->postJson('/api/shopper/orders', [...$cart, 'quote_token' => $token, 'idempotency_key' => (string) Str::uuid()])
            ->assertCreated()->assertJsonPath('order.payment_method', 'digital')->assertJsonPath('order.payment_status', 'unpaid')->json('order.order_id');
        return Order::findOrFail($id);
    }
    private function providerSession(Order $order, bool $paid = false, string $status = 'active'): array
    {
        $attempt = PaymentCheckoutAttempt::where('order_id', $order->order_id)->firstOrFail();
        return ['id' => 'cs_fixture'.$order->order_id, 'type' => 'checkout_session', 'attributes' => [
            'livemode' => false, 'status' => $status, 'checkout_url' => 'https://checkout.paymongo.com/cs_fixture'.$order->order_id,
            'reference_number' => 'GE-'.$order->order_id.'-'.$attempt->id, 'metadata' => app(PayMongoGateway::class)->metadata($order, $attempt),
            'line_items' => $order->items->map(fn ($item) => ['amount' => $item->unit_price_centavos, 'quantity' => $item->quantity, 'currency' => 'PHP'])->all(),
            'payments' => $paid ? [['id' => 'pay_fixture'.$order->order_id, 'type' => 'payment', 'attributes' => [
                'status' => 'paid', 'livemode' => false, 'amount' => $order->total_centavos, 'currency' => 'PHP', 'source' => ['type' => 'gcash'],
            ]]] : [],
        ]];
    }
    private function fake(array $session): void
    {
        Http::swap(new \Illuminate\Http\Client\Factory());
        Http::preventStrayRequests();
        Http::fake(['https://api.paymongo.com/*' => Http::response(['data' => $session])]);
    }
    private function webhook(Order $order, array $session, string $eventId = 'evt_fixture', ?string $secret = null, ?int $timestamp = null)
    {
        $raw = json_encode(['data' => ['id' => $eventId, 'type' => 'event', 'attributes' => [
            'type' => 'checkout_session.payment.paid', 'livemode' => false, 'data' => $session,
        ]]]);
        $timestamp ??= now()->timestamp;
        $signature = hash_hmac('sha256', $timestamp.'.'.$raw, $secret ?? 'whsec_fixture');
        return $this->call('POST', '/api/payments/paymongo/test/'.$order->store_id.'/webhook', [], [], [],
            ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_PAYMONGO_SIGNATURE' => 't='.$timestamp.',te='.$signature.',li='], $raw);
    }

    public function test_disabled_live_key_unconfigured_store_and_missing_holding_policy_fail_closed(): void
    {
        $this->signIn($this->shopper)->getJson('/api/shopper/stores/'.$this->otherStore->store_id.'/payment-options')
            ->assertOk()->assertJsonPath('digital.available', false);
        config(['payments.mode' => 'live']);
        $this->postJson('/api/shopper/checkout/quote', $this->digitalCart())->assertStatus(503);
        config(['payments.mode' => 'test', 'payments.merchants.'.$this->store->store_id.'.secret_key' => 'sk_live_forbidden']);
        $this->postJson('/api/shopper/checkout/quote', $this->digitalCart())->assertStatus(503);
        config(['payments.merchants.'.$this->store->store_id.'.secret_key' => 'sk_test_fixture']);
        $this->store->forceFill(['paid_order_holding_hours' => null])->save();
        $this->postJson('/api/shopper/checkout/quote', $this->digitalCart())->assertUnprocessable();
        Http::assertNothingSent();
    }

    public function test_digital_quote_exceeds_cop_limit_but_retains_schedule_stock_price_and_idempotency_guards(): void
    {
        $this->inventory->update(['selling_price' => '1000.00']);
        $cart = $this->digitalCart();
        $quote = $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $cart)->assertOk()->assertJsonPath('quote.total_centavos', 200000)->json('quote_token');
        $this->postJson('/api/shopper/checkout/quote', $this->cart())->assertUnprocessable();
        $payload = [...$cart, 'quote_token' => $quote, 'idempotency_key' => (string) Str::uuid()];
        $id = $this->postJson('/api/shopper/orders', $payload)->assertCreated()->json('order.order_id');
        $this->postJson('/api/shopper/orders', $payload)->assertOk()->assertJsonPath('order.order_id', $id);
        $this->postJson('/api/shopper/orders', [...$payload, 'payment_channel' => 'card'])->assertConflict();
        $this->assertDatabaseCount('payment_checkout_attempts', 1);
        $this->assertSame(4, $this->inventory->fresh()->soft_stock_qty);
        $this->postJson('/api/shopper/checkout/quote', [...$cart, 'pickup_date' => '2020-01-01'])->assertUnprocessable();
        $this->postJson('/api/shopper/checkout/quote', [...$cart, 'payment_status' => 'paid', 'provider_reference' => 'fake', 'amount' => 1])->assertUnprocessable();
    }

    public function test_session_uses_order_snapshot_and_repeated_start_returns_one_session(): void
    {
        $order = $this->digitalOrder(); $this->fake($this->providerSession($order));
        $this->inventory->update(['selling_price' => '99.00']);
        $path = '/api/shopper/orders/'.$order->order_id.'/payment-session';
        $this->postJson($path)->assertOk()->assertJsonPath('payment.status', 'pending_payment');
        $this->postJson($path)->assertOk();
        Http::assertSentCount(1);
        Http::assertSent(fn ($request) => $request->url() === 'https://api.paymongo.com/v2/checkout_sessions'
            && $request['data']['attributes']['line_items'][0]['amount'] === 6700
            && $request['data']['attributes']['payment_method_types'] === ['gcash']);
        $this->assertSame(4, $this->inventory->fresh()->soft_stock_qty);
        $this->signIn($this->other)->postJson($path)->assertNotFound();
        $this->signIn($this->supervisor)->postJson($path)->assertForbidden();
    }

    public function test_ambiguous_creation_is_not_retried_or_automatically_released(): void
    {
        $order = $this->digitalOrder();
        Http::fake(['https://api.paymongo.com/*' => Http::failedConnection()]);
        $path = '/api/shopper/orders/'.$order->order_id.'/payment-session';
        $this->postJson($path)->assertStatus(502);
        $this->postJson($path)->assertConflict();
        Http::assertSentCount(1);
        $this->travel(20)->minutes();
        $result = app(PaymentCheckout::class)->expireUnpaid();
        $this->assertSame(1, $result['preserved_for_reconciliation']);
        $this->assertSame(4, $this->inventory->fresh()->soft_stock_qty);
        $this->assertDatabaseHas('payment_checkout_attempts', ['order_id' => $order->order_id, 'status' => 'reconciliation_required']);
    }

    public function test_signed_payment_is_recorded_once_but_still_requires_preparation_qr_pin_and_handover(): void
    {
        $order = $this->digitalOrder(); $session = $this->providerSession($order, true); $this->fake($session);
        $this->webhook($order, $session)->assertOk();
        $this->webhook($order, $session)->assertOk();
        $this->webhook($order, $session, 'evt_second')->assertOk();
        $this->assertDatabaseCount('order_payments', 1);
        $this->assertDatabaseHas('orders', ['order_id' => $order->order_id, 'payment_status' => 'paid', 'status' => 'waiting', 'reservation_status' => 'active']);
        $this->orderId = $order->order_id;
        $this->signIn($this->supervisor)->putJson($this->path('handover'), ['physically_handed_over' => true])->assertConflict();
        $credential = $this->ready();
        $this->travelTo($order->pickup_window_start_at->copy()->addMinutes(5));
        $this->signIn($this->supervisor)->putJson($this->path('handover'), ['physically_handed_over' => true])->assertConflict();
        $this->postJson($this->path('pickup-verification'), $this->identity($credential))->assertOk();
        $this->putJson($this->path('handover'), ['physically_handed_over' => true])->assertOk();
        $this->assertSame(98, $this->inventory->fresh()->hard_stock_qty);
        $this->assertSame(2, $this->inventory->fresh()->soft_stock_qty);
    }

    public function test_forged_stale_live_and_wrong_store_webhooks_cannot_mark_paid(): void
    {
        $order = $this->digitalOrder(); $session = $this->providerSession($order, true); $this->fake($session);
        $this->webhook($order, $session, secret: 'wrong')->assertUnauthorized();
        $this->webhook($order, $session, timestamp: now()->subMinutes(6)->timestamp)->assertUnauthorized();
        $session['attributes']['livemode'] = true;
        $this->webhook($order, $session)->assertConflict();
        $session = $this->providerSession($order, true); $session['attributes']['metadata']['store_id'] = (string) $this->otherStore->store_id;
        $this->webhook($order, $session)->assertConflict();
        $this->assertDatabaseCount('order_payments', 0);
        Http::assertNothingSent();
    }

    public static function invalidEvidence(): array { return [['amount'], ['currency'], ['livemode'], ['source'], ['reference'], ['merchant'], ['session']]; }
    #[DataProvider('invalidEvidence')]
    public function test_provider_api_evidence_must_match_exactly(string $field): void
    {
        $order = $this->digitalOrder(); $session = $this->providerSession($order, true); $provider = $session;
        if ($field === 'amount') $provider['attributes']['payments'][0]['attributes']['amount'] = 1;
        if ($field === 'currency') $provider['attributes']['payments'][0]['attributes']['currency'] = 'USD';
        if ($field === 'livemode') $provider['attributes']['payments'][0]['attributes']['livemode'] = true;
        if ($field === 'source') $provider['attributes']['payments'][0]['attributes']['source']['type'] = 'card';
        if ($field === 'reference') $provider['attributes']['reference_number'] = 'OTHER';
        if ($field === 'merchant') $provider['attributes']['organization_id'] = 'org_wrong';
        if ($field === 'session') $provider['id'] = 'cs_wrong';
        $this->fake($provider);
        $this->webhook($order, $session)->assertConflict();
        $this->assertDatabaseCount('order_payments', 0);
        $this->assertSame('unpaid', $order->fresh()->payment_status);
    }

    public function test_failed_attempt_and_browser_return_never_confirm_payment_and_cancellation_expires_provider_first(): void
    {
        $order = $this->digitalOrder(); $session = $this->providerSession($order);
        $session['attributes']['payments'] = [['id' => 'pay_failed', 'attributes' => ['status' => 'failed']]];
        $this->fake($session);
        $path = '/api/shopper/orders/'.$order->order_id.'/payment-session';
        $this->postJson($path)->assertOk();
        $this->getJson($path.'?payment_return=success')->assertOk()->assertJsonPath('payment.status', 'failed_attempt');
        $expired = $session; $expired['attributes']['status'] = 'expired';
        Http::swap(new \Illuminate\Http\Client\Factory());
        Http::preventStrayRequests();
        Http::fake(['https://api.paymongo.com/*/expire' => Http::response(['data' => $expired]), 'https://api.paymongo.com/*' => Http::response(['data' => $session])]);
        $this->putJson('/api/shopper/orders/'.$order->order_id.'/cancellation', ['reason' => 'Canceled sandbox payment'])->assertOk();
        $this->assertSame('released', $order->fresh()->reservation_status);
        $this->assertSame(2, $this->inventory->fresh()->soft_stock_qty);
        $this->assertDatabaseCount('order_payments', 0);
    }

    public function test_expiration_releases_once_but_processing_and_paid_delays_preserve_stock(): void
    {
        $order = $this->digitalOrder(); $this->travel(20)->minutes();
        $this->assertSame(1, app(PaymentCheckout::class)->expireUnpaid()['expired']);
        $this->assertSame(0, app(PaymentCheckout::class)->expireUnpaid()['expired']);
        $this->assertSame(2, $this->inventory->fresh()->soft_stock_qty);
        $order = $this->digitalOrder(); $session = $this->providerSession($order); $this->fake($session);
        $this->postJson('/api/shopper/orders/'.$order->order_id.'/payment-session')->assertOk();
        $session['attributes']['payments'] = [['id' => 'pay_processing', 'attributes' => ['status' => 'processing']]];
        $this->fake($session); $this->travel(20)->minutes();
        $this->assertSame(1, app(PaymentCheckout::class)->expireUnpaid()['preserved_for_reconciliation']);
        $this->assertSame(4, $this->inventory->fresh()->soft_stock_qty);
        $this->fake($this->providerSession($order, true));
        $this->assertSame(1, app(PaymentCheckout::class)->expireUnpaid()['preserved_for_reconciliation']);
        $this->assertSame('unpaid', $order->fresh()->payment_status);
    }

    public function test_uncertain_session_can_be_bound_then_provider_expiry_releases_stock_once(): void
    {
        $order = $this->digitalOrder();
        $attempt = PaymentCheckoutAttempt::where('order_id', $order->order_id)->firstOrFail();
        $attempt->update(['status' => 'reconciliation_required']);
        $session = $this->providerSession($order, status: 'expired'); $this->fake($session);
        app(PaymentCheckout::class)->reconcileSession($attempt->id, $session['id']);
        $this->travel(20)->minutes();
        $before = $this->inventory->fresh()->getAttributes();
        $preview = app(PaymentCheckout::class)->expireUnpaid(true);
        $this->assertSame(1, $preview['candidates']); $this->assertSame(0, $preview['expired']);
        $this->assertSame($before, $this->inventory->fresh()->getAttributes());
        $this->assertSame(1, app(PaymentCheckout::class)->expireUnpaid()['expired']);
        $this->assertSame(0, app(PaymentCheckout::class)->expireUnpaid()['expired']);
        $this->assertSame(2, $this->inventory->fresh()->soft_stock_qty);
    }

    public function test_same_event_id_with_changed_content_is_rejected_and_paid_reconciliation_preserves_evidence(): void
    {
        $order = $this->digitalOrder(); $session = $this->providerSession($order, true); $this->fake($session);
        $this->webhook($order, $session)->assertOk();
        $changed = $session; $changed['attributes']['line_items'][0]['amount'] = 1;
        $this->webhook($order, $changed)->assertConflict();
        $attempt = PaymentCheckoutAttempt::where('order_id', $order->order_id)->firstOrFail();
        app(PaymentCheckout::class)->reconcileSession($attempt->id, $session['id']);
        $this->assertSame('paid', $attempt->fresh()->status);
        $this->assertDatabaseCount('order_payments', 1);
    }

    public function test_signed_provider_confirmation_still_reconciles_an_inactive_shopper(): void
    {
        $order = $this->digitalOrder(); $session = $this->providerSession($order, true); $this->fake($session);
        $this->shopper->forceFill(['account_status' => 'inactive'])->save();
        $this->webhook($order, $session)->assertOk();
        $this->assertSame('paid', $order->fresh()->payment_status);
        $this->signIn($this->shopper)->getJson('/api/shopper/orders')->assertForbidden();
    }
}
