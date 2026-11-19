<?php

namespace App\Services;

use App\Models\Order;
use App\Models\PaymentCheckoutAttempt;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpException;

class XenditCheckout
{
    public function __construct(private XenditGateway $gateway) {}

    public function start(int $orderId, int $shopper): array
    {
        $claimed = false;
        [$order, $attempt] = app(PaymentCheckout::class)->locked($orderId, $shopper, function ($o, $a) use (&$claimed) {
            $this->gateway->boundMerchant($a);
            abort_unless($o->payment_status === 'unpaid' && $o->status === 'waiting' && $o->reservation_status === 'active' && $o->store->status === 'active', 409, 'This order cannot start a payment.');
            abort_if($a->expires_at->isPast(), 409, 'The reservation expired. Refresh this order and cancel safely before a new checkout.');
            if ($a->status === 'pending') {
                $this->gateway->requireCreationWindow($a->expires_at);
                $this->gateway->returnUrl($o->order_id, 'success');
                $a->status = 'creating'; $a->save(); $claimed = true;
            }
            return [$o, $a];
        });
        if (!$claimed) {
            abort_unless($attempt->provider_session_id, 409, 'Session creation is uncertain. The original attempt must be reconciled; no duplicate session was created.');
            return $this->status($orderId, $shopper);
        }
        try {
            $session = $this->gateway->create($order, $attempt);
            return app(PaymentCheckout::class)->locked($orderId, $shopper, function ($o, $a) use ($session) {
                $this->validateSession($o, $a, $session);
                $url = $this->gateway->hostedUrl($session['payment_link_url'] ?? '', $session['payment_session_id']);
                $a->provider_session_id = $session['payment_session_id']; $a->checkout_url = $url;
                if ($a->status !== 'paid') $a->status = match ($session['status']) { 'EXPIRED'=>'expired', 'CANCELED'=>'canceled', 'COMPLETED'=>'awaiting_confirmation', default=>'pending_payment' };
                $a->last_error = null; $a->save();
                // An immediately completed response still requires separate V3 verification.
                if ($session['status'] === 'COMPLETED') $this->refreshLocked($o, $a);
                return app(PaymentCheckout::class)->publicAttempt($a, true);
            });
        } catch (\Throwable $e) {
            PaymentCheckoutAttempt::whereKey($attempt->id)->where('status', 'creating')
                ->update(['status' => 'reconciliation_required', 'last_error' => 'session_creation_uncertain', 'updated_at' => now()]);
            if ($e instanceof HttpException) throw $e;
            abort(502, 'The Xendit session response is uncertain. Recover the existing attempt; do not submit another order.');
        }
    }

    public function status(int $order, ?int $shopper = null): array
    {
        return app(PaymentCheckout::class)->locked($order, $shopper, function ($o, $a) {
            if ($a->provider_session_id && $o->payment_status !== 'paid') $this->refreshLocked($o, $a);
            return app(PaymentCheckout::class)->publicAttempt($a, true);
        });
    }

    public function validateEnvelope(Order $o, PaymentCheckoutAttempt $a, array $s): void
    {
        $this->gateway->id($s['payment_session_id'] ?? null, 'ps');
        abort_unless($a->provider === 'xendit' && $a->mode === 'test' && $a->store_id === $o->store_id && $a->amount_centavos === $o->total_centavos
            && $a->currency === 'PHP' && $o->currency === 'PHP' && ($s['business_id'] ?? null) === $a->merchant_id
            && (!$a->provider_session_id || $a->provider_session_id === $s['payment_session_id'])
            && ($s['reference_id'] ?? null) === $a->provider_reference && ($s['session_type'] ?? null) === 'PAY'
            && ($s['mode'] ?? null) === 'PAYMENT_LINK' && ($s['country'] ?? null) === 'PH' && ($s['currency'] ?? null) === 'PHP'
            && XenditMoney::cents($s['amount'] ?? null) === $a->amount_centavos, 409, 'Xendit session/business/order/amount did not match the pinned TEST attempt.');
        abort_unless(in_array($s['status'] ?? null, ['ACTIVE','COMPLETED','EXPIRED','CANCELED'], true), 409, 'Unknown Xendit session state.');
    }

    public function validateSession(Order $o, PaymentCheckoutAttempt $a, array $s): void
    {
        $this->validateEnvelope($o, $a, $s);
        $codes = $s['allowed_payment_channels'] ?? []; $expected = array_keys(array_filter(XenditGateway::CHANNELS, fn ($v) => in_array($v, $a->channels, true)));
        abort_unless(is_array($codes) && count($codes) && count($codes) === count(array_unique($codes)), 409, 'A nonempty provider channel allowlist is required.');
        sort($codes); sort($expected);
        abort_unless($codes === $expected && ($s['capture_method'] ?? 'AUTOMATIC') === 'AUTOMATIC'
            && ($s['allow_save_payment_method'] ?? 'DISABLED') === 'DISABLED', 409, 'Xendit methods or capture/saving policy did not match.');
        abort_unless(is_string($s['expires_at'] ?? null) && preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/D', $s['expires_at']), 409, 'Provider session expiry is missing or invalid.');
        try { $expiry = CarbonImmutable::parse($s['expires_at']); } catch (\Throwable) { abort(409, 'Provider session expiry is invalid.'); }
        abort_if($expiry->getTimestamp() > $a->expires_at->getTimestamp(), 409, 'Provider session extends beyond the reserved-stock deadline.');
        if (isset($s['items'])) {
            abort_unless(is_array($s['items']) && count($s['items']) <= 101, 409, 'Invalid Xendit item components.');
            $sum = 0;
            foreach ($s['items'] as $item) {
                $price = XenditMoney::cents($item['net_unit_amount'] ?? null); $qty = $item['quantity'] ?? null;
                abort_unless(is_int($qty) && $qty > 0 && $price <= intdiv(FinancialMoney::MAX, $qty), 409, 'Invalid Xendit item amount.');
                $sum += $price * $qty;
            }
            abort_unless($sum === $a->amount_centavos, 409, 'Xendit item components do not match the accepted total.');
        }
    }

    private function requestIds(PaymentCheckoutAttempt $a, array $s): array
    {
        $ids = array_values(array_unique(array_filter([$s['payment_request_id'] ?? null, $s['latest_payment_request_id'] ?? null, ...($a->observed_request_ids ?? [])])));
        abort_if(count($ids) > 20, 409, 'Too many provider requests. Preserve the reservation for manual reconciliation.');
        foreach ($ids as $id) $this->gateway->id($id, 'pr');
        $a->observed_request_ids = $ids;
        $a->provider_request_id = $s['payment_request_id'] ?? $s['latest_payment_request_id'] ?? $a->provider_request_id;
        return $ids;
    }

    private function validateRequest(PaymentCheckoutAttempt $a, array $r, string $id): void
    {
        abort_unless(($r['payment_request_id'] ?? null) === $id && ($r['business_id'] ?? null) === $a->merchant_id
            && is_string($r['reference_id'] ?? null) && $r['reference_id'] !== '' && mb_strlen($r['reference_id']) <= 255
            && ($r['type'] ?? null) === 'PAY' && ($r['country'] ?? null) === 'PH'
            && ($r['currency'] ?? null) === 'PHP' && ($r['capture_method'] ?? null) === 'AUTOMATIC'
            && XenditMoney::cents($r['request_amount'] ?? null) === $a->amount_centavos
            && in_array(XenditGateway::CHANNELS[$r['channel_code'] ?? ''] ?? null, $a->channels, true), 409, 'Xendit linked request did not match the frozen attempt.');
        abort_unless(in_array($r['status'] ?? null, ['ACCEPTING_PAYMENTS','REQUIRES_ACTION','AUTHORIZED','CANCELED','EXPIRED','SUCCEEDED','FAILED'], true), 409, 'Unknown Xendit request state.');
    }

    private function validatePayment(PaymentCheckoutAttempt $a, array $p, string $id, string $request, string $requestReference): void
    {
        abort_unless(($p['payment_id'] ?? null) === $id && ($p['payment_request_id'] ?? null) === $request && ($p['business_id'] ?? null) === $a->merchant_id
            && ($p['reference_id'] ?? null) === $requestReference && ($p['type'] ?? null) === 'PAY' && ($p['country'] ?? null) === 'PH'
            && ($p['currency'] ?? null) === 'PHP' && ($p['capture_method'] ?? null) === 'AUTOMATIC'
            && XenditMoney::cents($p['request_amount'] ?? null) === $a->amount_centavos
            && in_array(XenditGateway::CHANNELS[$p['channel_code'] ?? ''] ?? null, $a->channels, true), 409, 'Xendit linked payment did not match the frozen attempt.');
        abort_unless(in_array($p['status'] ?? null, ['AUTHORIZED','CANCELED','SUCCEEDED','FAILED','EXPIRED','PENDING'], true), 409, 'Unknown Xendit payment state.');
    }

    // Current locking read of the attempt precedes all provider verification and domain writes.
    public function refreshLocked(Order $o, PaymentCheckoutAttempt $a, ?string $sessionId = null, ?array $verifiedSession = null): array
    {
        $s = $verifiedSession ?? $this->gateway->session($a, $sessionId);
        $this->validateSession($o, $a, $s);
        $a->provider_session_id = $s['payment_session_id'];
        $this->requestIds($a, $s);
        if (!empty($s['payment_link_url'])) $a->checkout_url = $this->gateway->hostedUrl($s['payment_link_url'], $s['payment_session_id']);
        if ($o->payment_status === 'paid') return $s;
        if ($s['status'] === 'COMPLETED') {
            $pr = $this->gateway->id($s['payment_request_id'] ?? null, 'pr'); $py = $this->gateway->id($s['payment_id'] ?? null, 'py');
            $r = $this->gateway->paymentRequest($a, $pr); $this->validateRequest($a, $r, $pr);
            // Our immutable reference belongs to the Session. A V3 request can carry a
            // generated reference: bind payment -> retrieved request -> retrieved Session,
            // rather than assuming the two products reuse the same reference string.
            $p = $this->gateway->payment($a, $py); $this->validatePayment($a, $p, $py, $pr, $r['reference_id']);
            abort_unless($r['status'] === 'SUCCEEDED' && $p['status'] === 'SUCCEEDED' && (!isset($r['latest_payment_id']) || $r['latest_payment_id'] === $py), 409, 'Xendit capture is not confirmed. Keep this order pending reconciliation.');
            $captures = $p['captures'] ?? [];
            abort_unless(is_array($captures) && count($captures) === 1, 409, 'Exactly one full automatic capture is required.');
            $capture = $captures[0]; $cap = $this->gateway->id($capture['capture_id'] ?? null, 'cap');
            abort_unless(XenditMoney::cents($capture['capture_amount'] ?? null) === $a->amount_centavos, 409, 'Xendit captured amount did not match the full accepted total.');
            $evidence = ['business_id'=>$a->merchant_id,'session_id'=>$s['payment_session_id'],'request_id'=>$pr,'payment_id'=>$py,'capture_id'=>$cap,
                'reference_id'=>$a->provider_reference,'payment_reference_id'=>$r['reference_id'],'amount_centavos'=>$a->amount_centavos,'currency'=>'PHP','channel'=>$p['channel_code'],'status'=>'SUCCEEDED','type'=>'PAY'];
            $late = $o->status !== 'waiting' || $o->reservation_status !== 'active';
            DB::table('order_payments')->insert(['order_id'=>$o->order_id,'method'=>'digital','verification_source'=>'provider','provider'=>'xendit_test',
                'provider_reference'=>$py,'amount_centavos'=>$a->amount_centavos,'evidence_type'=>'xendit_session_v3_capture',
                'evidence_reference'=>Crypt::encryptString($a->id),'confirmed_at'=>now(),'created_at'=>now(),'updated_at'=>now()]);
            $a->provider_payment_id=$py; $a->provider_request_id=$pr; $a->provider_capture_id=$cap; $a->verified_at=now(); $a->verified_evidence=$evidence;
            $a->status='paid'; $a->last_error=$late ? 'late_payment_review_required' : null; $a->save();
            $o->payment_status='paid'; if ($late) $o->refund_status='pending_decision'; $o->save();
            app(OrderNotifications::class)->notify($o,'digital_paid',$late ? 'Late TEST payment received. Existing order/stock state is preserved; contact the store for payment review.' : 'Xendit TEST payment verified. Preparation, QR/PIN verification and physical handover are still required.');
        } else {
            $a->status = match ($s['status']) { 'EXPIRED'=>'expired', 'CANCELED'=>'canceled', default=>'pending_payment' };
            $latest = $s['latest_payment_request_id'] ?? $s['payment_request_id'] ?? null;
            if ($latest) {
                $r=$this->gateway->paymentRequest($a,$latest); $this->validateRequest($a,$r,$latest);
                if ($s['status']==='ACTIVE' && $r['status']==='FAILED') $a->status='failed_attempt';
                if (in_array($r['status'],['AUTHORIZED','SUCCEEDED'],true)) $a->status='awaiting_confirmation';
            }
            $a->last_error=null; $a->save();
        }
        return $s;
    }

    public function cancelLocked(Order $o, PaymentCheckoutAttempt $a, ?int $actor, string $reason, bool $expired): void
    {
        if ($o->status === 'canceled' && $o->reservation_status === 'released') return;
        abort_unless($o->payment_status === 'unpaid' && $o->status === 'waiting' && $o->reservation_status === 'active',409,'Only an active unpaid order may release its reservation.');
        if ($a->provider_session_id) {
            $s=$this->gateway->session($a); $this->validateSession($o,$a,$s);
            abort_if($s['status']==='COMPLETED' || !empty($s['payment_id']),409,'A potentially paid session requires payment verification. Reserved stock is preserved.');
            if ($s['status']==='ACTIVE') {
                $this->gateway->cancel($a);
                $s=$this->gateway->session($a); $this->validateSession($o,$a,$s); // Never trust the cancel POST acknowledgement alone.
            }
            abort_unless(in_array($s['status'],['CANCELED','EXPIRED'],true),409,'Xendit closure is not confirmed; reserved stock is preserved.');
            $ids=$this->requestIds($a,$s);
            foreach($ids as $id) {
                $r=$this->gateway->paymentRequest($a,$id); $this->validateRequest($a,$r,$id);
                abort_unless(in_array($r['status'],['CANCELED','EXPIRED','FAILED'],true),409,'A linked payment request can still succeed. Await provider confirmation; stock remains reserved.');
                if (!empty($r['latest_payment_id'])) {
                    $py=$this->gateway->id($r['latest_payment_id'],'py'); $p=$this->gateway->payment($a,$py); $this->validatePayment($a,$p,$py,$id,$r['reference_id']);
                    abort_unless(in_array($p['status'],['CANCELED','EXPIRED','FAILED'],true) && empty($p['captures']),409,'Linked payment/capture is unresolved. Stock remains reserved.');
                }
            }
            abort_if(!empty($s['payment_id']),409,'Paid session requires review.');
        } else abort_unless($a->status==='pending',409,'Uncertain session creation must be reconciled before stock is released.');
        app(PaymentCheckout::class)->releaseReservationLocked($o,$a,$actor,$reason,$expired);
    }

    public function receive(int $store, array $payload): array
    {
        $topic=$payload['event']??'';
        if (!in_array($topic,['payment_session.completed','payment_session.expired'],true)) return ['message'=>'Authenticated event ignored.'];
        $s=$payload['data']??[];
        abort_unless(is_array($s) && ($payload['business_id']??null)===($s['business_id']??null),409,'Webhook business mismatch.');
        $a=PaymentCheckoutAttempt::where(['store_id'=>$store,'provider'=>'xendit','provider_reference'=>$s['reference_id']??''])->first();
        if (!$a) return ['message'=>'Unknown authenticated test session ignored.'];
        $eventId=hash('sha256',implode(':',['xendit','test',$a->merchant_id,$s['payment_session_id']??'',$topic]));
        app(PaymentCheckout::class)->locked($a->order_id,null,function($o,$locked)use($s,$topic,$eventId){
            $this->validateEnvelope($o,$locked,$s);
            abort_unless($s['status']===($topic==='payment_session.completed'?'COMPLETED':'EXPIRED'),409,'Webhook event/state mismatch.');
            $pr=$s['payment_request_id']??null; $py=$s['payment_id']??null;
            if($topic==='payment_session.completed'){ $this->gateway->id($pr,'pr'); $this->gateway->id($py,'py'); }
            DB::table('xendit_session_events')->insertOrIgnore(['id'=>$eventId,'attempt_id'=>$locked->id,'topic'=>$topic,
                'session_id'=>$s['payment_session_id'],'request_id'=>$pr,'payment_id'=>$py,'received_at'=>now()]);
            $existing=DB::table('xendit_session_events')->where('id',$eventId)->lockForUpdate()->first();
            abort_unless($existing->attempt_id===$locked->id && $existing->request_id===$pr && $existing->payment_id===$py,409,'Webhook semantic identity conflict.');
        }); // Durable receipt survives provider/network verification failure.
        return ['message'=>'Xendit TEST session event durably received; provider verification is pending.'];
    }

    public function processEvent(string $id): void
    {
        $event=DB::table('xendit_session_events')->find($id); if(!$event||$event->status==='processed')return;
        $attempt=PaymentCheckoutAttempt::findOrFail($event->attempt_id);
        try {
            app(PaymentCheckout::class)->locked($attempt->order_id,null,function($o,$a)use($id){
                $e=DB::table('xendit_session_events')->where('id',$id)->lockForUpdate()->first(); if($e->status==='processed')return;
                $s=$this->gateway->session($a,$e->session_id); $this->validateSession($o,$a,$s);
                if($e->topic==='payment_session.completed')abort_unless($s['status']==='COMPLETED' && ($s['payment_request_id']??null)===$e->request_id && ($s['payment_id']??null)===$e->payment_id,409,'Provider has not confirmed this completed event.');
                // An older expired notification can never downgrade a captured session/payment.
                if($e->topic==='payment_session.expired')abort_unless(in_array($s['status'],['EXPIRED','CANCELED','COMPLETED'],true),409,'Provider expiry is not confirmed.');
                if($o->payment_status!=='paid')$this->refreshLocked($o,$a,$e->session_id,$s);
                if($e->topic==='payment_session.expired' && $o->payment_status!=='paid')$this->cancelLocked($o,$a,null,'Xendit confirmed session expiry and safe closure of linked requests.',true);
                DB::table('xendit_session_events')->where('id',$id)->update(['status'=>'processed','last_error'=>null,'processed_at'=>now()]);
            });
        } catch (\Throwable $e) {
            DB::table('xendit_session_events')->where('id',$id)->where('status','!=','processed')->update(['last_error'=>'verification_retry_required']);
            if($e instanceof HttpException)throw $e;
            abort(503,'Xendit event saved; verification must be retried.');
        }
    }

    public function retryEvents(): array
    {
        $result=['processed'=>0,'pending'=>0];
        foreach(DB::table('xendit_session_events')->where('status','pending')->orderBy('received_at')->limit(25)->pluck('id') as $id){
            try{$this->processEvent($id);$result['processed']++;}catch(HttpException){$result['pending']++;}
        }
        return $result;
    }

    public function simulate(string $id): array
    {
        abort_unless(app()->environment(['local','testing']) && config('payments.mode') === 'test',403,'Simulation is local/test CLI only.');
        $initial=PaymentCheckoutAttempt::where(['provider'=>'xendit','mode'=>'test'])->findOrFail($id);
        return app(PaymentCheckout::class)->locked($initial->order_id,null,function($o,$a){
            abort_unless($o->status==='waiting' && $o->payment_status==='unpaid' && $o->reservation_status==='active'
                && in_array($a->status,['pending_payment','failed_attempt'],true) && $a->provider_session_id && $a->expires_at->isFuture(),409,'Only an existing active, linked Xendit TEST attempt may be simulated.');
            $s=$this->gateway->session($a);$this->validateSession($o,$a,$s);abort_unless($s['status']==='ACTIVE',409,'A terminal session cannot be simulated.');
            $pr=$s['latest_payment_request_id']??$s['payment_request_id']??null;
            abort_unless($pr,409,'Select GCash on the hosted checkout first to create a linked payment request.');
            $r=$this->gateway->paymentRequest($a,$pr);$this->validateRequest($a,$r,$pr);
            abort_unless(in_array($r['status'],['REQUIRES_ACTION','ACCEPTING_PAYMENTS'],true),409,'This request is terminal, authorized, or unsupported for simulation.');
            $result=$this->gateway->simulate($a,$pr);abort_unless(($result['status']??null)==='PENDING',502,'Unexpected simulation acknowledgement. Verify via provider before recording payment.');
            return ['status'=>'PENDING','message'=>'Simulation requested; payment remains unverified until provider verification.'];
        });
    }
}
