<?php

namespace App\Services;

use App\Models\Order;
use App\Models\PickupCredential;
use App\Models\Store;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class PickupPolicy
{
    public function requireSchema(): void
    {
        foreach (['pickup_credentials', 'order_payments', 'pickup_verifications', 'order_handovers'] as $table) {
            abort_unless(Schema::hasTable($table), 503, 'Pickup is awaiting database setup.');
        }
        app(PickupScheduling::class)->requireSchema();
    }

    // The caller holds the store and order locks. Ready and credential issuance commit together.
    public function issue(Order $order): void
    {
        $this->requireSchema();
        $store = Store::whereKey($order->store_id)->lockForUpdate()->firstOrFail();
        abort_unless($order->pickup_window_end_at && $order->scheduled_store_closes_at, 409, 'An approved pickup schedule is required.');
        app(PickupScheduling::class)->hours($store, $order->pickup_window_start_at->copy()->setTimezone(PickupScheduling::TIMEZONE)->format('Y-m-d'));
        $readyAt = $order->ready_at ?? now();
        if ($order->payment_method === 'cash_on_pickup' && $order->payment_status === 'unpaid') {
            $deadline = $order->scheduled_store_closes_at->copy();
        } else {
            $payment = DB::table('order_payments')->where('order_id', $order->order_id)->lockForUpdate()->first();
            abort_unless(app(PaymentEvidence::class)->valid($order, $payment), 409, 'Verified payment evidence is required for a paid-order holding deadline.');
            abort_unless(in_array($store->paid_order_holding_hours, [24, 48], true), 409, 'Configure the store approved 24- or 48-hour paid holding policy first.');
            $start = $order->pickup_window_end_at->greaterThan($readyAt) ? $order->pickup_window_end_at : $readyAt;
            $deadline = $start->copy()->addHours($store->paid_order_holding_hours);
        }
        abort_unless($deadline->isFuture(), 409, 'The pickup deadline passed. Approve a new pickup schedule first.');
        PickupCredential::where('order_id', $order->order_id)->whereNull('consumed_at')->whereNull('revoked_at')
            ->update(['revoked_at' => now(), 'revocation_reason' => 'Replaced after an approved schedule change', 'updated_at' => now()]);
        $token = bin2hex(random_bytes(32));
        $pin = str_pad((string) random_int(0, 99999999), 8, '0', STR_PAD_LEFT);
        PickupCredential::create([
            'order_id' => $order->order_id, 'token_hash' => hash('sha256', $token),
            'pin_hash' => Hash::make($pin), 'secret_payload' => ['qr_token' => $token, 'pin' => $pin],
            'expires_at' => $deadline,
        ]);
        $order->ready_at = $readyAt;
        $order->claim_expires_at = $deadline;
        $order->claim_status = 'claimable';
    }

    public function requireClaimable(Order $order, Store $store): void
    {
        abort_unless($order->status === 'ready_for_pickup' && $order->claim_status === 'claimable'
            && $order->reservation_status === 'active' && $order->claim_expires_at?->isFuture(), 409, 'This order is not currently claimable.');
        app(PickupScheduling::class)->requireOpen($store);
    }
}
