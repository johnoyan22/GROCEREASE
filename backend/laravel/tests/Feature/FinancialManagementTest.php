<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\PaymentCheckoutAttempt;
use App\Services\FinancialLedger;
use App\Services\FinancialMoney;
use App\Services\FinancialPolicy;
use App\Services\PaymentCheckout;
use App\Services\PayMongoGateway;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\TransactionTestCase;

class FinancialManagementTest extends TransactionTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->inventory->forceFill(['selling_price' => '100.00'])->save();
    }

    private function financialPost(string $action, array $in = [], string $mode = 'test', ?int $store = null, ?string $key = null)
    {
        return $this->postJson('/api/admin/financial/'.($store ?? $this->store->store_id).'/'.$action,
            $in + ['mode' => $mode, 'idempotency_key' => $key ?? (string) Str::uuid(), 'reason' => 'Test authorized action']);
    }

    private function agreement(array $in = [], string $mode = 'test')
    {
        return $this->financialPost('agreement', $in + ['amount' => '500.00', 'period' => 'monthly', 'starts_on' => '2026-10-01', 'status' => 'active', 'expected_version' => 0], $mode);
    }

    private function receipt(bool $verify = true): int
    {
        $this->signIn($this->admin);
        $this->agreement()->assertOk();
        $bill = $this->financialPost('bill', ['coverage_from' => '2026-10-01', 'due_on' => '2026-10-18', 'expected_version' => 1])->assertOk()->json('result.id');
        $payment = $this->financialPost('payment', ['id' => $bill, 'amount' => '500.00', 'paid_on' => '2026-10-18', 'method' => 'bank_transfer', 'evidence' => 'Test bank reference 123'])->assertOk()->json('result.id');
        if ($verify) $this->financialPost('verify', ['id' => $payment, 'expected_version' => 1])->assertOk();
        return $payment;
    }

    private function policy(array $in = []): array
    {
        return $this->signIn($this->admin)->financialPost('policy', $in + ['expected_version' => app(FinancialPolicy::class)->current($this->store->store_id)['version'],
            'fee_enabled' => true, 'rate_bps' => 300, 'cap' => null, 'approval_note' => 'Isolated test-store approval', 'digital_enabled' => true, 'digital_methods' => null])->assertOk()->json('result');
    }

    private function workspace(string $section = 'subscriptions', string $mode = 'test', array $in = [])
    {
        return $this->getJson('/api/admin/financial/'.$this->store->store_id.'?'.http_build_query($in + ['section' => $section, 'mode' => $mode]));
    }

    public function test_admin_only_active_and_strict_payloads_and_no_reservation_route(): void
    {
        foreach ([$this->shopper, $this->supervisor, $this->inventoryWorker] as $user) {
            $this->signIn($user)->getJson('/api/admin/financial/options')->assertForbidden();
            $this->financialPost('agreement')->assertForbidden();
        }
        $this->admin->forceFill(['account_status' => 'inactive'])->save();
        $this->signIn($this->admin)->getJson('/api/admin/financial/options')->assertForbidden();
        $this->admin->forceFill(['account_status' => 'active'])->save();
        $this->agreement(['actor_id' => $this->shopper->id])->assertUnprocessable();
        $this->financialPost('reserve', ['amount' => '1.00'])->assertNotFound();
        $this->workspace('funding', 'all')->assertUnprocessable();
        $this->workspace('subscriptions', 'test', ['until' => '2026-10-19'])->assertOk();
        $this->workspace('subscriptions', 'test', ['from' => '2026-10-20', 'until' => '2026-10-19'])->assertUnprocessable();
        $this->workspace('funding', 'test', ['sort' => 'amount;drop'])->assertUnprocessable();
    }

    public function test_bills_snapshot_agreement_and_overlap_void_and_manila_overdue(): void
    {
        $this->signIn($this->admin); $this->agreement()->assertOk();
        $bill = ['coverage_from' => '2026-10-01', 'due_on' => '2026-10-18', 'expected_version' => 1];
        $id = $this->financialPost('bill', $bill)->assertOk()->json('result.id');
        $this->financialPost('bill', [...$bill, 'coverage_from' => '2026-10-02'])->assertConflict();
        $this->agreement(['amount' => '700.00', 'period' => 'annual', 'expected_version' => 1])->assertOk();
        $this->assertDatabaseHas('subscription_bills', ['id' => $id, 'amount_centavos' => 50000, 'period' => 'monthly', 'coverage_until' => '2026-10-31', 'agreement_version' => 1]);
        $this->workspace()->assertOk()->assertJsonPath('records.data.0.status', 'overdue');
        $this->travelTo(\Carbon\CarbonImmutable::parse('2026-10-18 15:59:59', 'UTC'));
        $this->workspace()->assertOk()->assertJsonPath('records.data.0.status', 'pending');
        $this->travelTo(\Carbon\CarbonImmutable::parse('2026-10-18 16:00:00', 'UTC'));
        $this->workspace()->assertOk()->assertJsonPath('records.data.0.status', 'overdue');
        $this->financialPost('void_bill', ['id' => $id])->assertOk();
        $this->workspace()->assertJsonPath('records.data.0.status', 'voided');
        $this->financialPost('bill', [...$bill, 'expected_version' => 2])->assertOk();
        $this->assertDatabaseCount('subscription_bills', 2);
    }

    public function test_full_settlement_duplicate_evidence_verification_and_private_history(): void
    {
        $payment = $this->receipt(false);
        $bill = DB::table('subscription_payments')->find($payment)->bill_id;
        $this->financialPost('contribute', ['id' => $payment, 'amount' => '100.00'])->assertUnprocessable();
        $this->financialPost('verify', ['id' => $payment, 'expected_version' => 0])->assertConflict();
        $this->financialPost('verify', ['id' => $payment, 'expected_version' => 1])->assertOk();
        $this->workspace()->assertJsonPath('records.data.0.status', 'paid');
        $stored = DB::table('subscription_payments')->find($payment);
        $this->assertStringNotContainsString('Test bank reference', $stored->evidence);
        $this->workspace()->assertDontSee('Test bank reference');
        $this->getJson('/api/admin/financial/'.$this->store->store_id.'/bills/'.$bill.'?mode=test')->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('payments.data.0.evidence', 'Test bank reference 123');
        $this->financialPost('void_bill', ['id' => $bill])->assertConflict();
        $next = $this->financialPost('bill', ['coverage_from' => '2026-11-01', 'due_on' => '2026-11-10', 'expected_version' => 1])->assertOk()->json('result.id');
        $entry = ['id' => $next, 'amount' => '499.99', 'paid_on' => '2026-10-18', 'method' => 'cash', 'evidence' => 'different reference'];
        $this->financialPost('payment', $entry)->assertUnprocessable();
        $this->financialPost('payment', [...$entry, 'amount' => '500.01'])->assertUnprocessable();
        $this->financialPost('payment', [...$entry, 'amount' => '500.00', 'evidence' => ' test BANK reference   123 '])->assertConflict();
        $this->assertDatabaseCount('subscription_payments', 1);
    }

    public function test_contribution_idempotency_source_limits_and_store_mode_isolation(): void
    {
        $payment = $this->receipt(); $key = (string) Str::uuid();
        $in = ['id' => $payment, 'amount' => '100.00'];
        $first = $this->financialPost('contribute', $in, key: $key)->assertOk()->json();
        $this->assertSame($first, $this->financialPost('contribute', $in, key: $key)->assertOk()->json());
        $this->financialPost('contribute', [...$in, 'amount' => '101.00'], key: $key)->assertConflict();
        $this->financialPost('contribute', [...$in, 'amount' => '400.01'])->assertConflict();
        $this->financialPost('contribute', $in, 'actual')->assertNotFound();
        $this->financialPost('contribute', $in, store: $this->otherStore->store_id)->assertNotFound();
        $this->workspace('funding')->assertJsonPath('budget.available_centavos', 10000)->assertJsonPath('budget.net_funded_centavos', 10000);
        $this->workspace('funding','actual')->assertJsonPath('budget.available_centavos', 0);
        $this->assertDatabaseCount('incentive_movements', 1);
    }

    public function test_reserve_release_idempotency_and_atomic_blocked_source_reversal(): void
    {
        $payment = $this->receipt();
        $movement = $this->financialPost('contribute', ['id' => $payment, 'amount' => '100.00'])->assertOk()->json('result.id');
        $ledger = app(FinancialLedger::class); $key = (string) Str::uuid();
        $reserve = $ledger->reserve($this->admin->id, $this->store->store_id, 'test', '80.00', $key, 'Future authorized reservation');
        $this->assertSame($reserve, $ledger->reserve($this->admin->id, $this->store->store_id, 'test', '80.00', $key, 'Future authorized reservation'));
        $this->financialPost('return_contribution', ['id' => $movement])->assertConflict();
        $this->financialPost('reverse_payment', ['id' => $payment, 'expected_version' => 2])->assertConflict();
        $this->assertDatabaseCount('subscription_payment_reversals', 0);
        $releaseKey = (string) Str::uuid();
        $released = $ledger->release($this->admin->id, $this->store->store_id, 'test', $reserve['id'], $releaseKey, 'Release complete reservation');
        $this->assertSame($released, $ledger->release($this->admin->id, $this->store->store_id, 'test', $reserve['id'], $releaseKey, 'Release complete reservation'));
        $this->financialPost('reverse_payment', ['id' => $payment, 'expected_version' => 2])->assertOk();
        $this->assertDatabaseHas('incentive_movements', ['kind' => 'contribution_return', 'related_id' => $movement, 'amount_centavos' => 10000]);
        $this->workspace('funding')->assertJsonPath('budget.net_funded_centavos', 0)->assertJsonPath('budget.reserved_centavos', 0);
        $this->financialPost('contribute', ['id' => $payment, 'amount' => '1.00'])->assertUnprocessable();
        $this->workspace()->assertJsonPath('records.data.0.status','overdue');
    }

    public function test_return_restores_source_and_never_deletes_original_and_inactive_store_history(): void
    {
        $payment = $this->receipt();
        $movement = $this->financialPost('contribute', ['id' => $payment, 'amount' => '100.00'])->assertOk()->json('result.id');
        $this->store->forceFill(['status' => 'inactive'])->save();
        $this->financialPost('return_contribution', ['id' => $movement])->assertOk();
        $this->financialPost('return_contribution', ['id' => $movement])->assertConflict();
        $this->financialPost('contribute', ['id' => $payment, 'amount' => '500.00'])->assertOk();
        $this->assertDatabaseCount('incentive_movements', 3);
    }

    public static function malformedMoney(): array
    {
        return array_map(fn ($v) => [$v], ['-1.00','0','1e3','1.001','NaN','INF','1,000.00',' 1.00','42949672.96',500,0.1]);
    }

    #[DataProvider('malformedMoney')]
    public function test_money_rejects_unsafe_formats(mixed $amount): void
    {
        $this->signIn($this->admin)->agreement(['amount' => $amount])->assertUnprocessable();
        $this->assertDatabaseCount('subscription_agreements', 0);
    }

    public function test_fees_round_caps_and_stale_quotes_preserve_accepted_orders(): void
    {
        $this->policy();
        $cart = $this->cart();
        $quote = $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $cart)->assertOk()->assertJsonPath('quote.service_fee_centavos', 600)
            ->assertJsonPath('quote.total_centavos', 20600)->json('quote_token');
        $this->policy(['rate_bps' => 400]);
        $this->signIn($this->shopper)->postJson('/api/shopper/orders', [...$cart, 'quote_token' => $quote, 'idempotency_key' => (string) Str::uuid()])->assertConflict();
        $id = $this->placeOrder(); $accepted = Order::findOrFail($id);
        $this->policy(['fee_enabled' => false]);
        $this->assertSame(20800, Order::findOrFail($id)->total_centavos);
        $this->assertSame(400, $accepted->financial_policy_snapshot['rate_bps']);
        $this->assertSame(0, app(FinancialPolicy::class)->fee(app(FinancialPolicy::class)->current($this->otherStore->store_id), 100000));
        $this->assertSame(2, app(FinancialPolicy::class)->fee(['fee_enabled' => true,'rate_bps' => 300,'cap_centavos' => null], 50));
        $this->assertSame(1, app(FinancialPolicy::class)->fee(['fee_enabled' => true,'rate_bps' => 300,'cap_centavos' => 1], 50));
        $this->signIn($this->admin)->financialPost('policy',['expected_version'=>0,'fee_enabled'=>true,'rate_bps'=>300,'digital_enabled'=>true])->assertConflict();
    }

    public function test_fee_inclusive_cop_limit_and_approval_required(): void
    {
        $this->signIn($this->admin)->financialPost('policy', ['expected_version'=>0,'fee_enabled'=>true,'rate_bps'=>300,'digital_enabled'=>true])->assertUnprocessable();
        $this->policy();
        $this->inventory->forceFill(['selling_price' => '2499.99'])->save();
        $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote', $this->cart())->assertUnprocessable();
        $this->assertSame(FinancialMoney::MAX, FinancialMoney::parse('42949672.95'));
        $this->assertSame('PHP 90,071,992,547,409.91', FinancialMoney::format(9007199254740991));
    }

    public function test_provider_fee_line_and_pinned_attempt_survives_disabled_method(): void
    {
        Http::preventStrayRequests();
        config(['payments.provider'=>'paymongo','payments.mode'=>'test','payments.merchants'=>[$this->store->store_id=>[
            'merchant_id'=>'org_financefixture','secret_key'=>'sk_test_financefixture','webhook_secret'=>'fixture','methods'=>['gcash','card']]]]);
        $this->store->forceFill(['paid_order_holding_hours'=>24])->save();
        $this->policy();
        $cart = $this->cart() + ['payment_method'=>'digital','payment_channel'=>'wallet'];
        $this->inventory->forceFill(['selling_price'=>'42949672.95'])->save();
        $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote',[...$cart,'items'=>[['store_inventory_id'=>$this->inventory->store_inventory_id,'quantity'=>1]]])->assertUnprocessable();
        $this->inventory->forceFill(['selling_price'=>'100.00'])->save();
        $token = $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote',$cart)->assertOk()->json('quote_token');
        $id = $this->postJson('/api/shopper/orders',[...$cart,'quote_token'=>$token,'idempotency_key'=>(string)Str::uuid()])->assertCreated()->json('order.order_id');
        $order = Order::findOrFail($id); $attempt = PaymentCheckoutAttempt::where('order_id',$id)->firstOrFail();
        $this->policy(['digital_methods'=>['card']]);
        $this->signIn($this->shopper)->getJson('/api/shopper/stores/'.$this->store->store_id.'/payment-options')->assertJsonPath('digital.channels',['card']);
        $this->postJson('/api/shopper/checkout/quote',$cart)->assertUnprocessable();
        $this->postJson('/api/shopper/checkout/quote',[...$cart,'payment_channel'=>'card'])->assertOk();
        $this->policy(['digital_enabled'=>false]);
        $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote',$cart)->assertUnprocessable();
        $this->getJson('/api/shopper/stores/'.$this->store->store_id.'/payment-options')->assertJsonPath('digital.available',false);
        $session = ['id'=>'cs_financefixture','type'=>'checkout_session','attributes'=>[
            'livemode'=>false,'status'=>'active','checkout_url'=>'https://checkout.paymongo.com/cs_financefixture',
            'reference_number'=>'GE-'.$id.'-'.$attempt->id,'metadata'=>app(PayMongoGateway::class)->metadata($order,$attempt),
            'line_items'=>[['amount'=>10000,'quantity'=>2,'currency'=>'PHP'],['amount'=>600,'quantity'=>1,'currency'=>'PHP']], 'payments'=>[]]];
        Http::fake(['https://api.paymongo.com/*'=>Http::response(['data'=>$session])]);
        app(PaymentCheckout::class)->start($id,$this->shopper->id);
        Http::assertSent(fn ($r) => $r->method()==='POST' && $r['data']['attributes']['line_items'][1]['name']==='Service charge'
            && array_sum(array_map(fn ($l)=>$l['amount']*$l['quantity'],$r['data']['attributes']['line_items']))===20600);
        $session['attributes']['payments'] = [['id'=>'pay_financefixture','type'=>'payment','attributes'=>['status'=>'paid','livemode'=>false,'amount'=>20600,'currency'=>'PHP','source'=>['type'=>'gcash']]]];
        Http::swap(new \Illuminate\Http\Client\Factory()); Http::fake(['https://api.paymongo.com/*'=>Http::response(['data'=>$session])]);
        app(PaymentCheckout::class)->reconcileSession($attempt->id, 'cs_financefixture');

        $this->assertSame('unpaid',Order::findOrFail($id)->payment_status);
        $send = function (array $data, string $event) {
            $raw = json_encode(['data'=>['id'=>$event,'type'=>'event','attributes'=>['type'=>'checkout_session.payment.paid','livemode'=>false,'data'=>$data]]]);
            $signature = hash_hmac('sha256',now()->timestamp.'.'.$raw,'fixture');
            return $this->call('POST','/api/payments/paymongo/test/'.$this->store->store_id.'/webhook',[],[],[],
                ['CONTENT_TYPE'=>'application/json','HTTP_ACCEPT'=>'application/json','HTTP_PAYMONGO_SIGNATURE'=>'t='.now()->timestamp.',te='.$signature.',li='],$raw);
        };
        $bad = $session; array_pop($bad['attributes']['line_items']);
        Http::swap(new \Illuminate\Http\Client\Factory()); Http::fake(['https://api.paymongo.com/*'=>Http::response(['data'=>$bad])]);
        $send($bad,'evt_missingfee')->assertConflict();
        $this->assertSame('unpaid',Order::findOrFail($id)->payment_status);
        Http::swap(new \Illuminate\Http\Client\Factory()); Http::fake(['https://api.paymongo.com/*'=>Http::response(['data'=>$session])]);
        $send($session,'evt_financialvalid')->assertOk();
        $send($session,'evt_financialvalid')->assertOk();
        $this->assertSame('paid',Order::findOrFail($id)->payment_status);
        $this->assertDatabaseCount('order_payments',1);
        config(['reports.cache_store'=>'array']);
        $report = $this->signIn($this->admin)->postJson('/api/reports',['type'=>'financial','mode'=>'test'])->assertCreated()->json('report');
        $this->assertSame(600,array_column($report['metrics'],'value','label')['Verified service-fee components in period']);

    }

    public function test_financial_report_activity_current_balances_mode_and_pdf_snapshot(): void
    {
        config(['reports.cache_store'=>'array']);
        $payment = $this->receipt();
        $this->financialPost('contribute',['id'=>$payment,'amount'=>'100.00'])->assertOk();
        $report = $this->postJson('/api/reports',['type'=>'financial','mode'=>'test','from'=>'2026-10-19','until'=>'2026-10-19'])->assertCreated()->json('report');
        $metrics = array_column($report['metrics'],'value','label');
        $this->assertSame(50000,$metrics['Payments verified in period']);
        $this->assertSame(10000,$metrics['Current available funding']);
        $this->assertSame(40000,$metrics['Current unallocated verified receipts']);
        $pdf = $this->get('/api/reports/'.$report['id'].'/pdf')->assertOk()->assertHeader('Content-Type','application/pdf')->getContent();
        $this->assertStringStartsWith('%PDF-', $pdf);
        if (getenv('FINANCIAL_PDF_QA')) { file_put_contents(base_path('../../tmp/financial-summary.pdf'),$pdf); file_put_contents(base_path('../../tmp/financial-summary.json'),json_encode($report,JSON_PRETTY_PRINT)); }
        $this->financialPost('contribute',['id'=>$payment,'amount'=>'50.00'])->assertOk();
        $this->getJson('/api/reports/'.$report['id'])->assertOk()->assertJsonPath('report.metrics',$report['metrics']);
        $actual = $this->postJson('/api/reports',['type'=>'financial','mode'=>'actual'])->assertCreated()->json('report');
        $this->assertSame(0,array_column($actual['metrics'],'value','label')['Current available funding']);
        $this->postJson('/api/reports',['type'=>'financial','mode'=>'all'])->assertUnprocessable();
        $this->signIn($this->supervisor)->postJson('/api/reports',['type'=>'financial'])->assertForbidden();
    }
}
