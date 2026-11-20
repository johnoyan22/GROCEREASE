<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\PaymentCheckoutAttempt;
use App\Services\PaymentCheckout;
use App\Services\PaymentEvidence;
use App\Services\XenditCheckout;
use App\Services\XenditMoney;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\TransactionTestCase;

class XenditCheckoutTest extends TransactionTestCase
{
    private array $session=[];
    private array $request=[];
    private array $payment=[];
    private string $callback='xendit-callback-fixture-not-a-secret';

    protected function setUp(): void
    {
        parent::setUp(); Http::preventStrayRequests();
        config(['payments.provider'=>'xendit','payments.mode'=>'test','app.frontend_url'=>'https://grocer-demo.example',
            'payments.xendit'=>['store_id'=>$this->store->store_id,'merchant_id'=>str_repeat('a',24),'secret_key'=>'xnd_development_fixture_not_a_real_key',
                'webhook_secret'=>$this->callback,'channel_codes'=>['GCASH']], 'reports.cache_store'=>'array']);
        $this->store->forceFill(['paid_order_holding_hours'=>24])->save();
        $this->inventory->forceFill(['selling_price'=>'500.00'])->save();
    }

    private function digital(bool $fee=false): Order
    {
        if($fee)$this->signIn($this->admin)->postJson('/api/admin/financial/'.$this->store->store_id.'/policy',[
            'mode'=>'test','idempotency_key'=>(string)Str::uuid(),'reason'=>'Isolated Xendit test store approval','expected_version'=>0,
            'fee_enabled'=>true,'rate_bps'=>300,'approval_note'=>'TEST only approval','digital_enabled'=>true,'digital_methods'=>null])->assertOk();
        $cart=$this->cart()+['payment_method'=>'digital','payment_channel'=>'wallet'];
        $token=$this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote',$cart)->assertOk()->json('quote_token');
        $id=$this->postJson('/api/shopper/orders',[...$cart,'quote_token'=>$token,'idempotency_key'=>(string)Str::uuid()])->assertCreated()->json('order.order_id');
        $order=Order::findOrFail($id); $a=$this->attempt($id);
        $pr='pr-'.$a->id; $py='py-'.$a->id;
        $this->session=['payment_session_id'=>'ps-'.substr(hash('sha256',$a->id),0,24),'business_id'=>$a->merchant_id,'reference_id'=>$a->provider_reference,
            'session_type'=>'PAY','mode'=>'PAYMENT_LINK','country'=>'PH','currency'=>'PHP','amount'=>XenditMoney::decimal($a->amount_centavos),
            'capture_method'=>'AUTOMATIC','allow_save_payment_method'=>'DISABLED','allowed_payment_channels'=>['GCASH'],'status'=>'ACTIVE',
            'expires_at'=>$a->expires_at->toIso8601String(),'payment_request_id'=>null,'latest_payment_request_id'=>null,'payment_id'=>null];
        $this->session['payment_link_url']='https://checkout-staging.xendit.co/sessions/'.$this->session['payment_session_id'];
        $this->request=['business_id'=>$a->merchant_id,'reference_id'=>$a->provider_reference,'payment_request_id'=>$pr,'type'=>'PAY','country'=>'PH','currency'=>'PHP',
            'request_amount'=>XenditMoney::decimal($a->amount_centavos),'capture_method'=>'AUTOMATIC','channel_code'=>'GCASH','status'=>'REQUIRES_ACTION'];
        $this->payment=['payment_id'=>$py,'business_id'=>$a->merchant_id,'reference_id'=>$a->provider_reference,'payment_request_id'=>$pr,'type'=>'PAY',
            'country'=>'PH','currency'=>'PHP','request_amount'=>XenditMoney::decimal($a->amount_centavos),'capture_method'=>'AUTOMATIC','channel_code'=>'GCASH','status'=>'SUCCEEDED',
            'captures'=>[['capture_id'=>'cptr-'.$a->id,'capture_amount'=>XenditMoney::decimal($a->amount_centavos),'capture_timestamp'=>now()->toIso8601String()]]];
        return $order;
    }

    private function attempt(int $id): PaymentCheckoutAttempt { return PaymentCheckoutAttempt::where('order_id',$id)->firstOrFail(); }
    private function raw(array $data): string
    {
        return preg_replace('/("(?:request_amount|capture_amount)"\s*:\s*)"([0-9]+\.[0-9]{2})"/','$1$2',XenditMoney::encode($data));
    }
    private function fake(): void
    {
        Http::swap(new \Illuminate\Http\Client\Factory()); Http::preventStrayRequests();
        Http::fake(function($r){
            $path=parse_url($r->url(),PHP_URL_PATH);
            if(str_ends_with($path,'/simulate'))return Http::response(['status'=>'PENDING','message'=>'Simulation processing']);
            if(str_ends_with($path,'/cancel')){ $this->session['status']='CANCELED';return Http::response($this->raw($this->session),200,['Content-Type'=>'application/json']); }
            $data=str_starts_with($path,'/v3/payments/')?$this->payment:(str_starts_with($path,'/v3/payment_requests/')?$this->request:$this->session);
            return Http::response($this->raw($data),200,['Content-Type'=>'application/json']);
        });
    }
    private function complete(): void
    {
        $this->session['status']='COMPLETED'; $this->session['payment_request_id']=$this->request['payment_request_id'];
        $this->session['latest_payment_request_id']=$this->request['payment_request_id']; $this->session['payment_id']=$this->payment['payment_id'];
        $this->request['status']='SUCCEEDED';$this->request['latest_payment_id']=$this->payment['payment_id'];
    }
    private function webhook(string $topic='payment_session.completed', ?array $s=null, ?string $token=null, ?int $store=null, bool $process=true)
    {
        $response = $this->call('POST','/api/payments/xendit/test/'.($store??$this->store->store_id).'/webhook',[],[],[],
            ['CONTENT_TYPE'=>'application/json','HTTP_ACCEPT'=>'application/json','HTTP_X_CALLBACK_TOKEN'=>$token??$this->callback],
            $this->raw(['event'=>$topic,'business_id'=>str_repeat('a',24),'created'=>now()->toIso8601String(),'data'=>$s??$this->session]));
        if ($process && $response->status() === 200) app(XenditCheckout::class)->retryEvents();
        return $response;
    }
    private function start(Order $order)
    {
        return $this->signIn($this->shopper)->postJson('/api/shopper/orders/'.$order->order_id.'/payment-session',[]);
    }

    public function test_gcash_option_uses_wallet_category_through_quote_order_and_attempt(): void
    {
        $this->signIn($this->shopper)->getJson('/api/shopper/stores/'.$this->store->store_id.'/payment-options')
            ->assertOk()->assertJsonPath('digital.available', true)->assertJsonPath('digital.channels', ['gcash']);
        $cart = [...$this->cart(), 'payment_method' => 'digital', 'payment_channel' => 'wallet'];
        $this->postJson('/api/shopper/checkout/quote', [...$cart, 'payment_method' => 'gcash'])
            ->assertUnprocessable()->assertJsonValidationErrors('payment_method');
        $this->postJson('/api/shopper/checkout/quote', [...$cart, 'payment_channel' => 'gcash'])
            ->assertUnprocessable()->assertJsonValidationErrors('payment_channel');
        $quote = $this->postJson('/api/shopper/checkout/quote', $cart)->assertOk()
            ->assertJsonPath('quote.payment_method', 'digital')->assertJsonPath('quote.payment_channel', 'wallet');
        $id = $this->postJson('/api/shopper/orders', [...$cart, 'quote_token' => $quote->json('quote_token'), 'idempotency_key' => (string) Str::uuid()])
            ->assertCreated()->assertJsonPath('order.payment_method', 'digital')->assertJsonPath('order.payment_status', 'unpaid')->json('order.order_id');
        $this->assertSame(['gcash'], $this->attempt($id)->channels);
        $this->assertSame('xendit', $this->attempt($id)->provider);
        $this->assertSame('pending', $this->attempt($id)->status);
        $this->assertDatabaseCount('order_payments', 0);
        Http::assertNothingSent();
    }

    public function test_fee_inclusive_number_tokens_allowlist_id_binding_and_nonduplicate_resume(): void
    {
        $order=$this->digital(true);$this->fake();
        $this->assertSame(103000,$order->total_centavos);$this->assertSame('xendit',$this->attempt($order->order_id)->provider);
        $this->start($order)->assertOk()->assertJsonPath('payment.provider','xendit')->assertJsonPath('payment.status','pending_payment');
        Http::assertSent(function($r)use($order){
            if($r->method()!=='POST'||!str_ends_with($r->url(),'/sessions'))return false;
            $d=json_decode($r->body(),true);
            $this->assertSame(1030.0,$d['amount']);$this->assertStringContainsString('"amount":1030.00',$r->body());$this->assertSame(['GCASH'],$d['allowed_payment_channels']);$this->assertSame('DISABLED',$d['allow_save_payment_method']);
            $this->assertSame('AUTOMATIC',$d['capture_method']);$this->assertLessThanOrEqual(64,strlen($d['reference_id']));
            $this->assertSame(30.0,$d['items'][1]['net_unit_amount']);$this->assertSame('FEE',$d['items'][1]['type']);
            $this->assertStringContainsString('payment_order='.$order->order_id,$d['success_return_url']);$this->assertArrayNotHasKey('customer',$d);
            $this->assertFalse($r->hasHeader('Idempotency-Key'));return true;
        });
        $this->start($order)->assertOk();
        $this->assertCount(1,Http::recorded(fn($r)=>$r->method()==='POST'&&str_ends_with($r->url(),'/sessions')));
        $this->assertSame('unpaid',$order->fresh()->payment_status);
    }

    public function test_verified_payment_requires_capture_then_normal_qr_pin_handover_and_report_test_mode(): void
    {
        $order=$this->digital(true);$this->fake();$this->start($order)->assertOk();$this->complete();
        $this->webhook()->assertOk();$this->webhook()->assertOk();
        $this->assertDatabaseCount('order_payments',1);$this->assertDatabaseCount('xendit_session_events',1);
        $this->assertSame('waiting',$order->fresh()->status);$this->assertSame('paid',$order->fresh()->payment_status);
        $this->assertSame(100,$this->inventory->fresh()->hard_stock_qty);
        $p=DB::table('order_payments')->where('order_id',$order->order_id)->first();
        $this->assertTrue((bool)app(PaymentEvidence::class)->valid($order->fresh(),$p));
        $this->assertSame('test',app(PaymentEvidence::class)->mode($p));
        Http::assertSent(fn($r)=>str_contains($r->url(),'/v3/payments/')&&$r->hasHeader('api-version','2024-11-11'));
        $report=$this->signIn($this->admin)->postJson('/api/reports',['type'=>'financial','mode'=>'test'])->assertCreated()->json('report');
        $this->assertSame(3000,array_column($report['metrics'],'value','label')['Verified service-fee components in period']);
        $this->get('/api/reports/'.$report['id'].'/pdf')->assertOk()->assertHeader('Content-Type','application/pdf');
        $this->assertDatabaseCount('subscription_payments',0);$this->assertDatabaseCount('incentive_movements',0);
        $this->orderId=$order->order_id;$credential=$this->ready();
        $this->signIn($this->supervisor)->putJson($this->path('handover'),['physically_handed_over'=>true])->assertConflict();
        $this->travelTo($order->pickup_window_start_at->copy()->addMinutes(2));
        $this->postJson($this->path('pickup-verification'),$this->identity($credential))->assertOk();
        $this->putJson($this->path('handover'),['physically_handed_over'=>true])->assertOk();
        $this->putJson($this->path('handover'),['physically_handed_over'=>true])->assertConflict();
        $this->assertSame(98,$this->inventory->fresh()->hard_stock_qty);$this->assertSame('completed',$order->fresh()->status);
        $expired=$this->session;$expired['status']='EXPIRED';$this->webhook('payment_session.expired',$expired)->assertOk();
        $this->assertSame('completed',$order->fresh()->status);$this->assertDatabaseCount('order_handovers',1);
    }

    public function test_bad_token_business_store_and_client_totals_are_rejected_and_unknown_samples_ignored(): void
    {
        $order=$this->digital();$this->fake();$this->complete();
        $this->webhook(token:'wrong')->assertUnauthorized();
        $foreign=$this->session;$foreign['business_id']=str_repeat('b',24);$this->webhook(s:$foreign)->assertConflict();
        $bad=$this->session;$bad['amount']='1.00';$this->webhook(s:$bad)->assertConflict();
        $this->webhook(store:$this->otherStore->store_id)->assertStatus(503);
        $sample=$this->session;$sample['reference_id']='not-an-order';$this->webhook(s:$sample)->assertOk();
        $this->assertDatabaseCount('xendit_session_events',0);$this->assertDatabaseCount('order_payments',0);Http::assertNothingSent();
        $this->signIn($this->other)->postJson('/api/shopper/orders/'.$order->order_id.'/payment-session')->assertNotFound();
        $this->signIn($this->shopper)->postJson('/api/shopper/checkout/quote',$this->cart()+['total_centavos'=>1])->assertUnprocessable();
        $this->postJson('/api/shopper/orders/'.$order->order_id.'/payment-session',['amount'=>1])->assertUnprocessable();
    }

    public function test_verified_cptr_capture_is_recorded_once_on_refresh_and_duplicate_callbacks(): void
    {
        $order = $this->digital(); $this->fake(); $this->start($order)->assertOk(); $this->complete();
        $url = '/api/shopper/orders/'.$order->order_id.'/payment-session';
        $this->getJson($url)->assertOk()->assertJsonPath('payment.status', 'paid')->assertJsonPath('payment.verified', true);
        $this->getJson($url)->assertOk()->assertJsonPath('payment.verified', true);
        $this->webhook()->assertOk(); $this->webhook()->assertOk();
        $attempt = $this->attempt($order->order_id);
        $this->assertSame($this->payment['captures'][0]['capture_id'], $attempt->provider_capture_id);
        $this->assertSame($attempt->provider_capture_id, $attempt->verified_evidence['capture_id']);
        $this->assertSame('paid', $order->fresh()->payment_status);
        $this->assertSame('waiting', $order->fresh()->status);
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
        $this->assertSame(4, $this->inventory->fresh()->soft_stock_qty);
        $this->assertDatabaseCount('order_payments', 1);
        $payment = DB::table('order_payments')->where('order_id', $order->order_id)->first();
        $this->assertTrue((bool) app(PaymentEvidence::class)->valid($order->fresh(), $payment));
    }

    public function test_capture_identifier_accepts_current_and_legacy_prefixes_and_rejects_other_values(): void
    {
        $gateway = app(\App\Services\XenditGateway::class);
        $uuid = '12345678-1234-1234-1234-123456789abc';
        foreach (['cptr-'.$uuid, 'cap-'.$uuid, 'cap-1234567890abcdef12345678'] as $id) $this->assertSame($id, $gateway->id($id, 'cap'));
        foreach ([null, '', 'cptr-', 'py-'.$uuid, 'cptr-'.$uuid.'/extra', 'cptr-'.$uuid.'?next=evil', 'cptr-'.$uuid."\n"] as $id) $this->expectHttp(409, fn () => $gateway->id($id, 'cap'));
        $this->expectHttp(409, fn () => $gateway->id('cptr-'.$uuid, 'py'));
        $this->expectHttp(409, fn () => $gateway->id('cptr-'.$uuid, 'pr'));
    }

    public static function invalidEvidence(): array { return array_map(fn($v)=>[$v],['amount','currency','business','request','reference','channel','capture','capture_id','capture_count','authorized']); }
    #[DataProvider('invalidEvidence')]
    public function test_invalid_v3_evidence_stays_retryable_and_never_marks_paid(string $field): void
    {
        $order=$this->digital();$this->fake();$this->start($order)->assertOk();$this->complete();$original=$this->payment;
        match($field){
            'amount'=>$this->payment['request_amount']='999.99','currency'=>$this->payment['currency']='IDR','business'=>$this->payment['business_id']=str_repeat('b',24),
            'request'=>$this->payment['payment_request_id']='pr-'.(string)Str::uuid(),'reference'=>$this->payment['reference_id']='other',
            'channel'=>$this->payment['channel_code']='CARDS','capture'=>$this->payment['captures'][0]['capture_amount']='999.99',
            'capture_id'=>$this->payment['captures'][0]['capture_id']='py-'.(string)Str::uuid(),
            'capture_count'=>$this->payment['captures']=[],'authorized'=>$this->payment['status']='AUTHORIZED',
        };
        $this->webhook()->assertOk();$this->assertDatabaseCount('order_payments',0);$this->assertDatabaseCount('xendit_session_events',1);
        $this->assertSame('pending',DB::table('xendit_session_events')->value('status'));
        $this->assertSame('unpaid',$order->fresh()->payment_status);$this->assertSame(4,$this->inventory->fresh()->soft_stock_qty);
        $this->payment=$original;$this->artisan('payments:xendit-retry-events')->assertSuccessful();
        $this->assertSame('paid',$order->fresh()->payment_status);$this->assertDatabaseCount('order_payments',1);
    }

    public function test_timeout_cannot_post_twice_or_release_stock_and_cli_can_bind_original_session(): void
    {
        $order=$this->digital();
        $posts=0;Http::fake(function()use(&$posts){$posts++;throw new \Illuminate\Http\Client\ConnectionException('TEST timeout');});
        $this->start($order)->assertStatus(502);$this->assertSame('reconciliation_required',$this->attempt($order->order_id)->status);
        $this->start($order)->assertConflict();$this->assertSame(1,$posts);
        $this->putJson('/api/shopper/orders/'.$order->order_id.'/cancellation',['reason'=>'Cancel after uncertain session'])->assertConflict();
        $this->assertSame(4,$this->inventory->fresh()->soft_stock_qty);
        $this->fake();app(PaymentCheckout::class)->reconcileSession($this->attempt($order->order_id)->id,$this->session['payment_session_id']);
        $this->assertSame('pending_payment',$this->attempt($order->order_id)->status);$this->assertSame('unpaid',$order->fresh()->payment_status);
    }

    public static function hostedCheckoutLinks(): array
    {
        return [
            'staging session token' => ['https://checkout-staging.xendit.co/session/session-1234567890abcdef1234567890abcdef'],
            'shortlink underscore' => ['https://dev.xen.to/qZx5RD_7'],
            'shortlink hyphen' => ['https://dev.xen.to/aBcD-123'],
        ];
    }

    #[DataProvider('hostedCheckoutLinks')]
    public function test_provider_checkout_link_opens_and_resumes_the_same_session(string $url): void
    {
        $order = $this->digital();
        $this->session['payment_link_url'] = $url;
        $this->fake();
        $this->start($order)->assertOk()->assertJsonPath('payment.checkout_url', $this->session['payment_link_url']);
        $this->start($order)->assertOk()->assertJsonPath('payment.checkout_url', $this->session['payment_link_url']);
        $this->assertSame($this->session['payment_session_id'], $this->attempt($order->order_id)->provider_session_id);
        $this->assertCount(1, Http::recorded(fn ($r) => $r->method() === 'POST' && str_ends_with($r->url(), '/sessions')));
        $this->assertSame('unpaid', $order->fresh()->payment_status);
    }

    public function test_rejected_checkout_link_keeps_original_session_id_for_safe_recovery(): void
    {
        $order = $this->digital();
        $this->session['payment_link_url'] = 'https://untrusted.example/payment';
        $this->fake();
        $this->start($order)->assertStatus(502);
        $attempt = $this->attempt($order->order_id);
        $this->assertSame('reconciliation_required', $attempt->status);
        $this->assertSame($this->session['payment_session_id'], $attempt->provider_session_id);
        $this->assertNull($attempt->checkout_url);
        $this->start($order)->assertStatus(502);
        $this->assertCount(1, Http::recorded(fn ($r) => $r->method() === 'POST' && str_ends_with($r->url(), '/sessions')));
        $this->session['payment_link_url'] = 'https://checkout-staging.xendit.co/session/session-1234567890abcdef1234567890abcdef';
        $this->getJson('/api/shopper/orders/'.$order->order_id.'/payment-session')->assertOk()
            ->assertJsonPath('payment.status', 'pending_payment')->assertJsonPath('payment.checkout_url', $this->session['payment_link_url']);
        $this->assertSame(4, $this->inventory->fresh()->soft_stock_qty);
        $this->assertDatabaseCount('order_payments', 0);
    }

    public function test_expiry_and_cancel_wait_for_linked_requests_then_late_payment_never_reopens_stock(): void
    {
        $order=$this->digital();$this->fake();$this->start($order)->assertOk();
        $this->session['status']='EXPIRED';$this->session['latest_payment_request_id']=$this->request['payment_request_id'];
        $expired=$this->session;
        $this->webhook('payment_session.expired')->assertOk();$this->assertSame('active',$order->fresh()->reservation_status);
        $this->request['status']='EXPIRED';$this->webhook('payment_session.expired')->assertOk();
        $this->assertSame('canceled',$order->fresh()->status);$this->assertSame(2,$this->inventory->fresh()->soft_stock_qty);
        $this->complete();$this->webhook()->assertOk();$this->webhook()->assertOk();
        $this->assertSame('canceled',$order->fresh()->status);$this->assertSame('released',$order->fresh()->reservation_status);
        $this->assertSame('paid',$order->fresh()->payment_status);$this->assertSame('pending_decision',$order->fresh()->refund_status);
        $this->assertSame(2,$this->inventory->fresh()->soft_stock_qty);$this->assertDatabaseCount('order_payments',1);
        $this->webhook('payment_session.expired',$expired)->assertOk();$this->assertSame('paid',$order->fresh()->payment_status);
    }

    public function test_too_late_to_create_session_requires_safe_new_checkout_without_extending_reservation(): void
    {
        $order=$this->digital();$deadline=$this->attempt($order->order_id)->expires_at->toIso8601String();
        $this->travel(5)->minutes();$this->start($order)->assertUnprocessable();Http::assertNothingSent();
        $this->assertSame($deadline,$this->attempt($order->order_id)->expires_at->toIso8601String());
        $this->putJson('/api/shopper/orders/'.$order->order_id.'/cancellation',['reason'=>'Select a later payment window'])->assertOk();
        $this->assertSame('released',$order->fresh()->reservation_status);
    }

    public function test_simulation_uses_real_linked_request_and_pending_ack_never_becomes_payment(): void
    {
        $order=$this->digital();$this->fake();$this->start($order)->assertOk();$a=$this->attempt($order->order_id);
        $this->expectHttp(409,fn()=>app(XenditCheckout::class)->simulate($a->id));
        $this->session['latest_payment_request_id']=$this->request['payment_request_id'];
        $this->assertSame('PENDING',app(XenditCheckout::class)->simulate($a->id)['status']);
        Http::assertSent(fn($r)=>str_ends_with($r->url(),'/v3/payment_requests/'.$this->request['payment_request_id'].'/simulate')&&$r->hasHeader('api-version','2024-11-11'));
        $this->assertSame('unpaid',$order->fresh()->payment_status);$this->assertDatabaseCount('order_payments',0);
        $this->session['status']='EXPIRED';$this->expectHttp(409,fn()=>app(XenditCheckout::class)->simulate($a->id));
        $this->session['status']='ACTIVE';$a->update(['status'=>'canceled']);
        $this->expectHttp(409,fn()=>app(XenditCheckout::class)->simulate($a->id));
        app()->detectEnvironment(fn()=> 'production');$this->expectHttp(403,fn()=>app(XenditCheckout::class)->simulate($a->id));
    }

    private function expectHttp(int $status, callable $call): void
    {
        try{$call();$this->fail('Expected guarded request.');}catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){$this->assertSame($status,$e->getStatusCode());}
    }

    public function test_provider_switch_and_payment_rule_disable_preserve_existing_bound_attempt(): void
    {
        $order=$this->digital();$this->fake();$this->start($order)->assertOk();
        config(['payments.mode'=>'disabled','payments.provider'=>'paymongo']);
        $this->complete();$this->webhook()->assertOk();$this->assertSame('paid',$order->fresh()->payment_status);
        $this->assertTrue((bool)app(PaymentEvidence::class)->valid($order->fresh(),DB::table('order_payments')->where('order_id',$order->order_id)->first()));
        DB::table('order_payments')->where('order_id',$order->order_id)->update(['provider'=>'unknown_provider']);
        $this->assertFalse(app(PaymentEvidence::class)->valid($order->fresh(),DB::table('order_payments')->where('order_id',$order->order_id)->first()));
    }

    public function test_policy_allowlist_and_decimal_centavo_boundaries_and_live_keys_fail_closed(): void
    {
        $decoded=XenditMoney::decode('{"amount":0.29,"captures":[{"capture_amount":1030.01}],"request_amount":42949672.95}');
        $this->assertSame(29,XenditMoney::cents($decoded['amount']));$this->assertSame(103001,XenditMoney::cents($decoded['captures'][0]['capture_amount']));
        $this->assertSame(4294967295,XenditMoney::cents($decoded['request_amount']));$this->expectHttp(409,fn()=>XenditMoney::cents('1.001'));
        config(['payments.mode'=>'live']);$this->signIn($this->shopper)->getJson('/api/shopper/stores/'.$this->store->store_id.'/payment-options')->assertJsonPath('digital.available',false);
        config(['payments.mode'=>'test','payments.xendit.secret_key'=>'xnd_production_forbidden']);
        $this->postJson('/api/shopper/checkout/quote',$this->cart()+['payment_method'=>'digital','payment_channel'=>'wallet'])->assertStatus(503);
    }

    public function test_callback_acknowledges_durable_receipt_without_network_or_payment_until_worker(): void
    {
        $order=$this->digital();$this->complete();$this->fake();
        $this->webhook(process:false)->assertOk();Http::assertNothingSent();
        $this->assertDatabaseCount('xendit_session_events',1);$this->assertDatabaseCount('order_payments',0);
        $this->assertSame('pending',DB::table('xendit_session_events')->value('status'));
        $this->artisan('payments:xendit-retry-events')->assertSuccessful();
        $this->assertSame('paid',$order->fresh()->payment_status);
        $this->signIn($this->shopper)->getJson('/api/shopper/orders/'.$order->order_id.'/payment-session')->assertJsonPath('payment.verified',true);
    }

    public function test_generated_v3_reference_is_bound_through_the_actual_linked_request(): void
    {
        $order=$this->digital();$this->complete();
        $this->request['reference_id']='generated-request-reference_'.(string)Str::uuid();
        $this->payment['reference_id']=$this->request['reference_id'];$this->fake();
        $this->webhook()->assertOk();$this->assertSame('paid',$order->fresh()->payment_status);
        $e=$this->attempt($order->order_id)->verified_evidence;
        $this->assertSame($this->request['reference_id'],$e['payment_reference_id']);
        $this->assertSame($this->session['reference_id'],$e['reference_id']);
    }

    public function test_fee_and_method_edit_after_acceptance_keeps_pinned_xendit_total_and_channels(): void
    {
        $order=$this->digital(true);$this->fake();
        $version=app(\App\Services\FinancialPolicy::class)->current($this->store->store_id)['version'];
        $this->signIn($this->admin)->postJson('/api/admin/financial/'.$this->store->store_id.'/policy',[
            'mode'=>'test','idempotency_key'=>(string)Str::uuid(),'reason'=>'Disable new checkout after acceptance','expected_version'=>$version,
            'fee_enabled'=>false,'rate_bps'=>0,'approval_note'=>null,'digital_enabled'=>false,'digital_methods'=>[]])->assertOk();
        $this->signIn($this->shopper)->getJson('/api/shopper/stores/'.$this->store->store_id.'/payment-options')->assertJsonPath('digital.available',false);
        $this->postJson('/api/shopper/checkout/quote',$this->cart()+['payment_method'=>'digital','payment_channel'=>'wallet'])->assertUnprocessable();
        $this->start($order)->assertOk();$this->complete();
        config(['payments.xendit.channel_codes'=>[]]); // New-channel config can no longer gate an already pinned attempt.
        $this->webhook()->assertOk();$this->assertSame(103000,$order->fresh()->total_centavos);$this->assertSame('paid',$order->fresh()->payment_status);
    }

    public function test_unsupported_saved_methods_do_not_silently_enable_other_channels(): void
    {
        $this->signIn($this->admin)->postJson('/api/admin/financial/'.$this->store->store_id.'/policy',[
            'mode'=>'test','idempotency_key'=>(string)Str::uuid(),'reason'=>'Invalid provider method test','expected_version'=>0,
            'fee_enabled'=>false,'rate_bps'=>0,'digital_enabled'=>true,'digital_methods'=>['paymaya']])->assertUnprocessable();
        // A genuine historical policy version may still contain a method from the prior provider.
        $id=DB::table('store_financial_policy_versions')->insertGetId(['store_id'=>$this->store->store_id,'fee_enabled'=>false,'rate_bps'=>0,
            'digital_enabled'=>true,'digital_methods'=>'["paymaya"]','actor_id'=>$this->admin->id,'reason'=>'Historical policy fixture','created_at'=>now()]);
        DB::table('store_financial_policies')->insert(['store_id'=>$this->store->store_id,'version_id'=>$id]);
        $this->signIn($this->shopper)->getJson('/api/shopper/stores/'.$this->store->store_id.'/payment-options')->assertJsonPath('digital.available',false)->assertJsonPath('digital.channels',[])->assertSee('paymaya');
        $this->postJson('/api/shopper/checkout/quote',$this->cart()+['payment_method'=>'digital','payment_channel'=>'wallet'])->assertUnprocessable();
        $this->assertSame('["paymaya"]',DB::table('store_financial_policy_versions')->where('id',$id)->value('digital_methods'));
    }

    public function test_https_configuration_and_test_host_allowlist_fail_closed(): void
    {
        config(['app.frontend_url'=>'http://localhost:5173']);
        $this->signIn($this->shopper)->getJson('/api/shopper/stores/'.$this->store->store_id.'/payment-options')->assertJsonPath('digital.available',false);
        $gateway=app(\App\Services\XenditGateway::class);$id='ps-1234567890abcdef12345678';
        $this->assertSame('https://dev.xen.to/kGxPCi76',$gateway->hostedUrl('https://dev.xen.to/kGxPCi76',$id));
        foreach (self::hostedCheckoutLinks() as [$url]) $this->assertSame($url, $gateway->hostedUrl($url, $id));
        foreach(['https://checkout.xendit.co/sessions/'.$id,'https://checkout-staging.xendit.co.evil.test/sessions/'.$id,
            'https://user@dev.xen.to/kGxPCi76','http://dev.xen.to/kGxPCi76','https://dev.xen.to/kGxPCi76?next=evil',
            'https://checkout.xendit.co/session/session-1234567890abcdef1234567890abcdef',
            'https://checkout-staging.xendit.co/session/session-1234567890abcdef1234567890abcdef/extra',
            'https://checkout-staging.xendit.co/session/session-1234567890abcdef1234567890abcdef?next=evil',
            'https://checkout-staging.xendit.co/session/session-1234567890abcdef1234567890abcde'] as $url)$this->expectHttp(502,fn()=>$gateway->hostedUrl($url,$id));
    }
}
