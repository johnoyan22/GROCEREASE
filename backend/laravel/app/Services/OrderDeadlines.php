<?php

namespace App\Services;

use App\Models\Order;
use App\Models\PickupCredential;
use App\Models\Store;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class OrderDeadlines
{
    public function process(bool $dryRun = false): array
    {
        app(PickupScheduling::class)->requireSchema();
        $result = ['classified' => 0, 'reminders' => 0, 'dry_run' => $dryRun];
        Order::where('status', 'ready_for_pickup')->where('claim_status', 'claimable')->orderBy('order_id')
            ->chunkById(100, function ($orders) use (&$result, $dryRun) {
                foreach ($orders as $candidate) {
                    DB::transaction(function () use ($candidate, &$result, $dryRun) {
                        User::whereKey($candidate->shopper_user_id)->lockForUpdate()->firstOrFail();
                        $store = Store::whereKey($candidate->store_id)->lockForUpdate()->firstOrFail();
                        $order = Order::whereKey($candidate->order_id)->lockForUpdate()->firstOrFail();
                        if ($order->status !== 'ready_for_pickup' || $order->claim_status !== 'claimable' || $order->reservation_status !== 'active' || !$order->claim_expires_at || !$order->ready_at) return;
                        if (now()->lessThan($order->claim_expires_at)) {
                            if ($order->pickup_window_start_at && now()->greaterThanOrEqualTo($order->pickup_window_start_at)) {
                                if (!$dryRun) app(OrderNotifications::class)->notify($order, 'pickup_window_open', 'Your pickup window is open. Check My Orders and present your pickup code at the store.');
                                $result['reminders']++;
                            }
                            return;
                        }
                        if ($order->payment_method === 'cash_on_pickup' && $order->payment_status === 'unpaid') {
                            $date = $order->pickup_window_start_at?->setTimezone(PickupScheduling::TIMEZONE)->format('Y-m-d');
                            if (!$date || !$store->operating_hours || $store->status !== 'active' || !$order->scheduled_store_closes_at) return;
                            $day = $order->pickup_window_start_at->copy()->setTimezone(PickupScheduling::TIMEZONE)->isoWeekday();
                            $period = $store->operating_hours[$day] ?? null;
                            $recordedClosing = $order->scheduled_store_closes_at->copy()->setTimezone(PickupScheduling::TIMEZONE)->format('H:i');
                            if (!$period || ($period['closes_at'] ?? null) !== $recordedClosing) return;
                            if ($order->ready_at->greaterThanOrEqualTo($order->scheduled_store_closes_at)) return;
                            if (!$order->pickup_window_end_at || $order->ready_at->greaterThan($order->pickup_window_end_at)) return;
                            if (DB::table('store_pickup_exceptions')->where('store_id', $store->store_id)->where('date', $date)->lockForUpdate()->first()) return;
                            // A recorded in-person claimant or payment needs store review, not an automatic absence strike.
                            if (DB::table('pickup_verifications')->where('order_id', $order->order_id)->lockForUpdate()->first()) return;
                            if (DB::table('order_payments')->where('order_id', $order->order_id)->lockForUpdate()->first()) return;
                            if ($dryRun) { $result['classified']++; return; }
                            $existing = DB::table('cop_strikes')->where('order_id', $order->order_id)->lockForUpdate()->first();
                            if (!$existing) {
                                $status = app(CopRestrictions::class)->status($order->shopper_user_id);
                                $number = $status['strike_count'] + 1;
                                DB::table('cop_strikes')->insert(['order_id' => $order->order_id, 'shopper_user_id' => $order->shopper_user_id,
                                    'store_id' => $store->store_id, 'strike_number_at_issue' => $number, 'issued_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
                                $message = 'COP No-Show recorded: warning '.$number.'.';
                                if ($number === 2) $message .= ' Cash on Pickup is disabled for 30 days.';
                                if ($number >= 3) $message .= ' Cash on Pickup is permanently disabled; your Shopper account remains active.';
                                app(OrderNotifications::class)->notify($order, 'cop_no_show', $message);
                            }
                            $order->claim_status = 'no_show';
                            $order->unclaimed_reason = 'Ready COP order remained unclaimed at the scheduled store closing deadline. Stock disposition requires Supervisor review.';
                        } else {
                            // Paid unclaimed orders never receive COP strikes, including COP orders whose cash was already confirmed.
                            if ($order->payment_status !== 'paid') return;
                            $payment = DB::table('order_payments')->where('order_id', $order->order_id)->lockForUpdate()->first();
                            if (!app(PaymentEvidence::class)->valid($order, $payment)) return;
                            if ($dryRun) { $result['classified']++; return; }
                            $order->claim_status = 'unclaimed_pending_resolution';
                            $order->refund_status = 'pending_decision';
                            $order->unclaimed_reason = 'Paid order holding deadline expired. Preserve payment and reserved goods pending authorized reconciliation and refund decision.';
                            app(OrderNotifications::class)->notify($order, 'paid_unclaimed', 'Your paid order is unclaimed and awaiting store review. Contact the store about pickup disposition and the refund decision.');
                        }
                        $order->unclaimed_at = now();
                        $order->save();
                        PickupCredential::where('order_id', $order->order_id)->whereNull('consumed_at')->whereNull('revoked_at')
                            ->update(['revoked_at' => now(), 'revocation_reason' => 'Claim deadline expired', 'updated_at' => now()]);
                        // No stock release here: only a physical disposition review can establish suitability for resale.
                        $result['classified']++;
                    }, 3);
                }
            }, 'order_id');
        return $result;
    }
}
