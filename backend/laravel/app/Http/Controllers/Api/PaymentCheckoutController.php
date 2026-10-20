<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PaymentCheckoutAttempt;
use App\Models\Store;
use App\Services\PayMongoGateway;
use App\Services\PaymentCheckout;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PaymentCheckoutController extends Controller
{
    public function options(int $store, PayMongoGateway $gateway): JsonResponse
    {
        $record = Store::where('status', 'active')->findOrFail($store);
        $options = $gateway->options($store);
        if ($options['available'] && !in_array($record->paid_order_holding_hours, [24, 48], true)) {
            $options = ['available' => false, 'mode' => 'disabled', 'channels' => [], 'reason' => 'Configure the supermarket-approved 24- or 48-hour prepaid holding policy first.'];
        }
        return response()->json(['digital' => $options])->header('Cache-Control', 'no-store');
    }

    public function start(Request $request, int $order, PaymentCheckout $checkout): JsonResponse
    {
        $request->validate(['amount' => ['prohibited'], 'payment_status' => ['prohibited'], 'store_id' => ['prohibited'], 'provider_reference' => ['prohibited']]);
        return response()->json(['payment' => $checkout->start($order, $request->user()->id)])->header('Cache-Control', 'no-store');
    }

    public function show(Request $request, int $order, PaymentCheckout $checkout): JsonResponse
    {
        return response()->json(['payment' => $checkout->status($order, $request->user()->id)])->header('Cache-Control', 'no-store');
    }

    public function webhook(Request $request, int $store, PayMongoGateway $gateway, PaymentCheckout $checkout): JsonResponse
    {
        $merchant = $gateway->merchant($store);
        $gateway->requireSchema();
        $raw = $request->getContent();
        abort_if(strlen($raw) > 262144, 413);
        $parts = [];
        foreach (explode(',', $request->header('Paymongo-Signature', '')) as $part) {
            $pair = explode('=', trim($part), 2);
            abort_unless(count($pair) === 2 && !array_key_exists($pair[0], $parts), 401, 'Invalid webhook signature.');
            $parts[$pair[0]] = $pair[1];
        }
        $timestamp = $parts['t'] ?? '';
        $signature = $parts['te'] ?? '';
        abort_unless(ctype_digit($timestamp) && abs(now()->timestamp - (int) $timestamp) <= (int) config('payments.signature_tolerance_seconds')
            && preg_match('/^[a-f0-9]{64}$/', $signature) && empty($parts['li'])
            && hash_equals(hash_hmac('sha256', $timestamp.'.'.$raw, $merchant['webhook_secret']), $signature), 401, 'Invalid or outdated test webhook signature.');
        $payload = json_decode($raw, true);
        $event = $payload['data'] ?? [];
        $attributes = $event['attributes'] ?? [];
        abort_unless(($event['type'] ?? null) === 'event' && preg_match('/^evt_[a-zA-Z0-9]+$/', $event['id'] ?? '')
            && ($attributes['livemode'] ?? null) === false, 422, 'A valid test event is required.');
        if (($attributes['type'] ?? null) !== 'checkout_session.payment.paid') return response()->json(['message' => 'Event ignored.']);
        if (isset($attributes['organization_id'])) abort_unless($attributes['organization_id'] === $merchant['merchant_id'], 409, 'Webhook merchant mismatch.');
        $session = $attributes['data'] ?? [];
        $attempt = PaymentCheckoutAttempt::where('store_id', $store)->whereKey($session['attributes']['metadata']['attempt_id'] ?? '')->firstOrFail();
        abort_unless($attempt->merchant_id === $merchant['merchant_id'], 409, 'Webhook store mismatch.');
        $checkout->locked($attempt->order_id, null, function ($order, $locked) use ($event, $raw, $session, $gateway, $checkout) {
            $existing = DB::table('payment_webhook_events')->where('provider_event_id', $event['id'])->first();
            if ($existing) {
                abort_unless($existing->attempt_id === $locked->id && hash_equals($existing->body_hash, hash('sha256', $raw)), 409, 'A replayed event had different content.');
                return;
            }
            $checkout->validateSession($order, $locked, $session);
            // Retrieve under this store's bound test key; the client never supplies payment evidence.
            $verified = $gateway->retrieve($locked, $session['id']);
            abort_unless(($verified['id'] ?? null) === $session['id'], 409, 'Provider returned another checkout session.');
            $checkout->confirmPaidLocked($order, $locked, $verified);
            DB::table('payment_webhook_events')->insert(['provider_event_id' => $event['id'], 'attempt_id' => $locked->id,
                'body_hash' => hash('sha256', $raw), 'received_at' => now()]);
        });
        return response()->json(['message' => 'Test payment event recorded.']);
    }
}
