<?php

namespace App\Services;

use App\Models\Order;
use App\Models\PickupCredential;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class OrderData
{
    public function requireSchema(): void
    {
        if (! Schema::hasTable('orders') || ! Schema::hasTable('order_items') || ! Schema::hasTable('order_status_history')) {
            abort(503, 'Ordering is awaiting database setup. Please contact your administrator.');
        }
    }

    public function present(Order $order, bool $includeOperations = false): array
    {
        if ($includeOperations) {
            $order->setRelation('items', $order->items()->orderBy('order_item_id')->lockForUpdate()->get());
            $order->setRelation('history', $order->history()->lockForUpdate()->get());
        } else $order->loadMissing(['items', 'history']);
        $items = [];
        foreach ($order->items as $item) {
            $items[] = $item->only([
                'order_item_id', 'store_inventory_id', 'product_name', 'sku', 'size',
                'quantity', 'unit_price_centavos', 'line_total_centavos',
                'prepared_qty', 'prepared_by_user_id', 'prepared_at',
            ]);
        }
        $history = [];
        foreach ($order->history as $entry) {
            $history[] = [
                'id' => $entry->id, 'changed_by_user_id' => $entry->changed_by_user_id,
                'previous_status' => $entry->previous_status, 'new_status' => $entry->new_status,
                'note' => $entry->note, 'created_at' => $entry->created_at->toIso8601String(),
            ];
        }
        return [
            'order_id' => $order->order_id, 'store_id' => $order->store_id,
            'store_name' => $order->store_name, 'store_address' => $order->store_address,
            'shopper_name' => $order->shopper_name, 'status' => $order->status,
            'payment_method' => $order->payment_method, 'payment_status' => $order->payment_status,
            'reservation_status' => $order->reservation_status,
            'subtotal_centavos' => $order->subtotal_centavos, 'service_fee_centavos' => $order->service_fee_centavos,
            'total_centavos' => $order->total_centavos, 'currency' => $order->currency,
            'service_fee_policy' => $order->service_fee_policy,
            'created_at' => $order->created_at->toIso8601String(),
            'updated_at' => $order->updated_at->toIso8601String(),
            'canceled_at' => $order->canceled_at?->toIso8601String(),
            'completed_at' => $order->completed_at?->toIso8601String(),
            'pickup_window_start_at' => $order->pickup_window_start_at?->toIso8601String(),
            'pickup_window_end_at' => $order->pickup_window_end_at?->toIso8601String(),
            'claim_expires_at' => $order->claim_expires_at?->toIso8601String(),
            'claim_status' => $order->claim_status, 'refund_status' => $order->refund_status,
            'pickup_schedule_review_required' => (bool) $order->pickup_schedule_review_required,
            'unclaimed_reason' => $order->unclaimed_reason, 'ready_at' => $order->ready_at?->toIso8601String(),
            'items' => $items, 'history' => $history,
            'pickup' => $this->pickupSummary($order),
            'payment_checkout' => $order->payment_method === 'digital' && Schema::hasTable('payment_checkout_attempts')
                && ($attempt = \App\Models\PaymentCheckoutAttempt::where('order_id', $order->order_id)->first())
                ? app(PaymentCheckout::class)->publicAttempt($attempt) : null,
            'assignments' => $includeOperations && Schema::hasTable('worker_assignments') ? \App\Models\WorkerAssignment::where('order_id', $order->order_id)->orderBy('assignment_id')->lockForUpdate()->get([
                'assignment_id', 'worker_id', 'worker_name', 'task_type', 'status', 'assigned_by_user_id', 'assigned_at',
                'completed_by_user_id', 'completed_at', 'canceled_by_user_id', 'canceled_at', 'completion_note', 'cancellation_reason',
            ])->toArray() : [],
        ];
    }

    private function pickupSummary(Order $order): array
    {
        $summary = [
            'enabled' => $order->pickup_window_start_at !== null,
            'verified_at' => null, 'claimant_name' => null,
            'payment_confirmed_at' => null, 'handed_over_at' => null, 'expires_at' => null,
        ];
        if (!Schema::hasTable('pickup_verifications')) return $summary;
        $verified = DB::table('pickup_verifications')->where('order_id', $order->order_id)->first();
        $payment = DB::table('order_payments')->where('order_id', $order->order_id)->first();
        $handover = DB::table('order_handovers')->where('order_id', $order->order_id)->first();
        $credential = PickupCredential::where('order_id', $order->order_id)->whereNull('revoked_at')->latest('id')->first();
        $summary['verified_at'] = $verified?->verified_at;
        $summary['claimant_name'] = $verified?->claimant_name;
        $summary['payment_confirmed_at'] = $payment?->confirmed_at;
        $summary['handed_over_at'] = $handover?->handed_over_at;
        $summary['expires_at'] = $credential?->expires_at->toIso8601String();
        return $summary;
    }
}
