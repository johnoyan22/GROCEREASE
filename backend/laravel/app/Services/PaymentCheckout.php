<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\PaymentCheckoutAttempt;
use App\Models\Store;
use App\Models\StoreInventory;
use App\Models\User;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;

class PaymentCheckout
{
    public function __construct(private PayMongoGateway $gateway) {}

    // Called in the same transaction as the order and its reservation.
    public function createAttempt(Order $order, string $channel): void
    {
        $this->gateway->requireSchema();
        $merchant = $this->gateway->merchant($order->store_id);
        $channels = $channel === 'card' ? array_values(array_intersect($merchant['methods'], ['card']))
            : array_values(array_diff($merchant['methods'], ['card']));
        abort_unless($channels, 422, 'This payment channel is unavailable for the supermarket.');
        $expires = now()->addMinutes((int) config('payments.reservation_minutes'));
        if ($order->pickup_window_start_at->lessThan($expires)) $expires = $order->pickup_window_start_at->copy();
        PaymentCheckoutAttempt::create(['id' => (string) Str::uuid(), 'order_id' => $order->order_id,
            'store_id' => $order->store_id, 'merchant_id' => $merchant['merchant_id'],
            'credential_fingerprint' => hash('sha256', $merchant['secret_key']), 'mode' => 'test',
            'amount_centavos' => $order->total_centavos, 'currency' => $order->currency, 'channels' => $channels,
            'status' => 'pending', 'expires_at' => $expires]);
    }

    public function start(int $orderId, int $shopperId): array
    {
        $this->gateway->requireSchema();
        $claimed = false;
        [$order, $attempt] = $this->locked($orderId, $shopperId, function ($order, $attempt) use (&$claimed) {
            $this->gateway->boundMerchant($attempt);
            abort_unless($order->status === 'waiting' && $order->payment_status === 'unpaid' && $order->reservation_status === 'active', 409, 'This order cannot start a payment.');
            abort_unless($order->store->status === 'active', 409, 'The supermarket is unavailable.');
            abort_if($attempt->expires_at->isPast(), 409, 'This payment reservation expired. Refresh My Orders.');
            if ($attempt->status === 'pending') {
                // Commit this claim BEFORE the external request. Process interruption never permits a second POST.
                $attempt->status = 'creating'; $attempt->save(); $claimed = true;
            }
            return [$order, $attempt];
        });
        if (!$claimed) {
            abort_unless($attempt->provider_session_id, 409, 'The original session needs provider reconciliation. A duplicate session was not created.');
            return $this->publicAttempt($attempt, true);
        }
        try {
            $session = $this->gateway->create($order, $attempt);
            $this->validateSession($order, $attempt, $session);
            $url = $session['attributes']['checkout_url'] ?? '';
            $parsed = parse_url($url);
            abort_unless(($parsed['scheme'] ?? '') === 'https' && ($parsed['host'] ?? '') === 'checkout.paymongo.com'
                && !isset($parsed['user']) && !isset($parsed['pass']), 502, 'The sandbox provider returned an invalid hosted checkout URL.');
            return $this->locked($orderId, $shopperId, function ($current, $locked) use ($session, $url) {
                abort_if($locked->provider_session_id && $locked->provider_session_id !== $session['id'], 409, 'Provider session reconciliation is required.');
                $locked->provider_session_id = $session['id']; $locked->checkout_url = $url;
                if ($locked->status !== 'paid') $locked->status = 'pending_payment';
                $locked->last_error = null; $locked->save();
                return $this->publicAttempt($locked, true);
            });
        } catch (\Throwable $failure) {
            PaymentCheckoutAttempt::whereKey($attempt->id)->where('status', 'creating')
                ->update(['status' => 'reconciliation_required', 'last_error' => 'session_creation_uncertain', 'updated_at' => now()]);
            // Do not log provider requests, responses, credentials or checkout URLs.
            if ($failure instanceof HttpException) throw $failure;
            abort(502, 'The original sandbox session needs reconciliation before retrying.');
        }
    }

    public function status(int $orderId, int $shopperId): array
    {
        $this->gateway->requireSchema();
        return $this->locked($orderId, $shopperId, function ($order, $attempt) {
            if ($order->payment_status === 'unpaid' && $order->status === 'waiting' && $attempt->provider_session_id) {
                $session = $this->gateway->retrieve($attempt);
                $this->validateSession($order, $attempt, $session);
                $payments = collect($session['attributes']['payments'] ?? []);
                if ($payments->contains(fn ($row) => ($row['attributes']['status'] ?? null) === 'paid')) $attempt->status = 'awaiting_webhook';
                elseif (($session['attributes']['status'] ?? null) === 'expired') $attempt->status = 'expired';
                elseif ($payments->contains(fn ($row) => ($row['attributes']['status'] ?? null) === 'failed')) $attempt->status = 'failed_attempt';
                $attempt->save();
            }
            return $this->publicAttempt($attempt, true);
        });
    }

    public function reconcileSession(string $attemptId, string $sessionId): void
    {
        $this->gateway->requireSchema();
        $attempt = PaymentCheckoutAttempt::findOrFail($attemptId);
        $this->locked($attempt->order_id, null, function ($order, $locked) use ($sessionId) {
            $session = $this->gateway->retrieve($locked, $sessionId);
            $this->validateSession($order, $locked, $session);
            abort_unless($session['id'] === $sessionId, 409, 'The provider session did not match.');
            if ($order->payment_status === 'paid') return;
            abort_unless($order->status === 'waiting' && $order->reservation_status === 'active', 409, 'A finalized order requires separate payment reconciliation.');
            $locked->provider_session_id = $sessionId;
            // Reconciliation never fabricates a Paid state or accepts a user-supplied amount.
            $locked->status = 'awaiting_webhook';
            $locked->last_error = null; $locked->save();
        });
    }

    // Caller already holds user -> store -> order locks. Release ONLY after confirmed provider expiry.
    public function cancelLocked(Order $order, ?int $actorId, string $reason, bool $expired = false): void
    {
        $this->gateway->requireSchema();
        abort_unless($order->payment_method === 'digital' && $order->payment_status === 'unpaid'
            && $order->status === 'waiting' && $order->reservation_status === 'active', 409, 'Only an unpaid Waiting digital order can expire or cancel.');
        $attempt = PaymentCheckoutAttempt::where('order_id', $order->order_id)->lockForUpdate()->firstOrFail();
        if ($attempt->provider_session_id) {
            $session = $this->gateway->retrieve($attempt);
            $this->validateSession($order, $attempt, $session);
            $this->requireNoOngoingPayment($session);
            if (($session['attributes']['status'] ?? null) !== 'expired') {
                try { $session = $this->gateway->expire($attempt); }
                catch (HttpException $error) {
                    if ($error->getStatusCode() !== 409) throw $error;
                    $session = $this->gateway->retrieve($attempt); // Paid/processing/already expired are distinct cases.
                }
                $this->validateSession($order, $attempt, $session);
                $this->requireNoOngoingPayment($session);
            }
            abort_unless(($session['attributes']['status'] ?? null) === 'expired', 409, 'Provider expiry is unconfirmed. Reserved stock is preserved.');
        } else {
            abort_unless($attempt->status === 'pending', 409, 'An uncertain provider creation must be reconciled before stock can be released.');
        }
        foreach ($order->items()->orderBy('store_inventory_id')->get() as $item) {
            $inventory = StoreInventory::forStore($order->store_id)->whereKey($item->store_inventory_id)->lockForUpdate()->firstOrFail();
            abort_if($inventory->soft_stock_qty < $item->quantity, 409, 'Reserved stock requires reconciliation.');
            $inventory->soft_stock_qty -= $item->quantity; $inventory->stock_version++; $inventory->save();
        }
        $attempt->status = $expired ? 'expired' : 'canceled'; $attempt->expired_at = now(); $attempt->save();
        $order->status = 'canceled'; $order->reservation_status = 'released'; $order->claim_status = 'canceled';
        $order->canceled_at = now(); $order->save();
        if ($actorId) OrderStatusHistory::create(['order_id' => $order->order_id, 'changed_by_user_id' => $actorId,
            'previous_status' => 'waiting', 'new_status' => 'canceled', 'note' => $reason]);
        app(OrderNotifications::class)->notify($order, $expired ? 'digital_expired' : 'digital_canceled', $reason);
    }

    public function expireUnpaid(bool $dryRun = false): array
    {
        if (!\Illuminate\Support\Facades\Schema::hasTable('payment_checkout_attempts')) return ['expired' => 0, 'preserved_for_reconciliation' => 0, 'candidates' => 0, 'dry_run' => $dryRun];
        $result = ['expired' => 0, 'preserved_for_reconciliation' => 0, 'candidates' => 0, 'dry_run' => $dryRun];
        PaymentCheckoutAttempt::where('expires_at', '<=', now())->whereNull('expired_at')->where('status', '!=', 'paid')->orderBy('id')
            ->chunkById(100, function ($attempts) use (&$result, $dryRun) {
                foreach ($attempts as $attempt) {
                    try {
                        $this->locked($attempt->order_id, null, function ($order, $locked) use (&$result, $dryRun) {
                            if ($order->payment_status === 'paid' || $order->status !== 'waiting' || $locked->expired_at) return;
                            $result['candidates']++;
                            if ($dryRun) return;
                            $this->cancelLocked($order, null, 'Unpaid sandbox payment reservation expired; the order was canceled and stock released after provider expiry.', true);
                            $result['expired']++;
                        });
                    } catch (HttpException) { $result['preserved_for_reconciliation']++; }
                }
            }, 'id');
        return $result;
    }

    public function validateSession(Order $order, PaymentCheckoutAttempt $attempt, array $session): void
    {
        $attributes = $session['attributes'] ?? [];
        abort_unless(($session['type'] ?? null) === 'checkout_session' && preg_match('/^cs_[a-zA-Z0-9]+$/', $session['id'] ?? '')
            && (!$attempt->provider_session_id || $attempt->provider_session_id === $session['id'])
            && ($attributes['livemode'] ?? null) === false
            && ($attributes['reference_number'] ?? null) === 'GE-'.$order->order_id.'-'.$attempt->id
            && ($attributes['metadata'] ?? null) == $this->gateway->metadata($order, $attempt)
            && $attempt->store_id === $order->store_id && $attempt->amount_centavos === $order->total_centavos
            && $attempt->currency === 'PHP' && $order->currency === 'PHP', 409, 'Provider session identity, test mode or order amount did not match.');
        if (isset($attributes['organization_id'])) abort_unless($attributes['organization_id'] === $attempt->merchant_id, 409, 'Provider merchant did not match.');
        $sum = 0;
        foreach ($attributes['line_items'] ?? [] as $line) {
            abort_unless(is_int($line['amount'] ?? null) && is_int($line['quantity'] ?? null) && $line['amount'] >= 0
                && $line['quantity'] > 0 && ($line['currency'] ?? null) === 'PHP'
                && $line['amount'] <= intdiv(4294967295, $line['quantity']), 409, 'Provider line-item amount is invalid.');
            $sum += $line['amount'] * $line['quantity'];
        }
        abort_unless($sum === $order->total_centavos, 409, 'Provider line items did not match the stored order total.');
    }

    public function confirmPaidLocked(Order $order, PaymentCheckoutAttempt $attempt, array $session): void
    {
        $this->validateSession($order, $attempt, $session);
        $paid = array_values(array_filter($session['attributes']['payments'] ?? [], fn ($row) => ($row['attributes']['status'] ?? null) === 'paid'));
        abort_unless(count($paid) === 1, 409, 'One authentic paid payment is required.');
        $payment = $paid[0]; $attributes = $payment['attributes'];
        abort_unless(preg_match('/^pay_[a-zA-Z0-9]+$/', $payment['id'] ?? '') && ($attributes['amount'] ?? null) === $order->total_centavos
            && ($attributes['currency'] ?? null) === 'PHP' && ($attributes['livemode'] ?? null) === false
            && in_array($attributes['source']['type'] ?? null, $attempt->channels, true), 409, 'Provider payment amount, currency, test mode or channel did not match.');
        if ($order->payment_status === 'paid') {
            abort_unless($attempt->provider_payment_id === $payment['id'], 409, 'A different payment was already recorded.');
            return;
        }
        abort_unless($order->status === 'waiting' && $order->reservation_status === 'active', 409, 'This order requires manual paid-payment reconciliation.');
        DB::table('order_payments')->insert(['order_id' => $order->order_id, 'method' => 'digital', 'verification_source' => 'provider',
            'provider' => 'paymongo_test', 'provider_reference' => $payment['id'], 'amount_centavos' => $order->total_centavos,
            'evidence_type' => 'signed_webhook_and_provider_api', 'evidence_reference' => Crypt::encryptString($attempt->id),
            'confirmed_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        $attempt->provider_session_id = $session['id']; $attempt->provider_payment_id = $payment['id'];
        $attempt->status = 'paid'; $attempt->last_error = null; $attempt->save();
        $order->payment_status = 'paid'; $order->save();
        app(OrderNotifications::class)->notify($order, 'digital_paid', 'Sandbox payment confirmed. Preparation, pickup verification and physical handover are still required.');
    }

    public function publicAttempt(PaymentCheckoutAttempt $attempt, bool $includeUrl = false): array
    {
        return ['status' => $attempt->status, 'mode' => 'test', 'expires_at' => $attempt->expires_at->toIso8601String(),
            'last_error' => $attempt->last_error,
            'checkout_url' => $includeUrl && in_array($attempt->status, ['pending_payment', 'failed_attempt'], true) && $attempt->expires_at->isFuture() ? $attempt->checkout_url : null];
    }

    public function locked(int $orderId, ?int $shopperId, callable $callback): mixed
    {
        $initial = Order::where('payment_method', 'digital')->when($shopperId, fn ($q) => $q->where('shopper_user_id', $shopperId))->findOrFail($orderId);
        return DB::transaction(function () use ($initial, $shopperId, $callback) {
            User::whereKey($initial->shopper_user_id)->lockForUpdate()->firstOrFail();
            Store::whereKey($initial->store_id)->lockForUpdate()->firstOrFail();
            $order = Order::whereKey($initial->order_id)->when($shopperId, fn ($q) => $q->where('shopper_user_id', $shopperId))->lockForUpdate()->firstOrFail();
            $attempt = PaymentCheckoutAttempt::where('order_id', $order->order_id)->lockForUpdate()->firstOrFail();
            return $callback($order, $attempt);
        }, 3);
    }

    private function requireNoOngoingPayment(array $session): void
    {
        foreach ($session['attributes']['payments'] ?? [] as $payment) {
            abort_if(in_array($payment['attributes']['status'] ?? null, ['paid', 'pending', 'processing'], true), 409, 'A payment is paid or processing. Preserve its reservation and await trusted confirmation.');
        }
        abort_if(in_array($session['attributes']['payment_intent']['attributes']['status'] ?? null, ['succeeded', 'processing'], true), 409, 'Payment processing is unresolved. Reserved stock is preserved.');
    }
}
