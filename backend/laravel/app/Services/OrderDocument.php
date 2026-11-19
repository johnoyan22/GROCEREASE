<?php

namespace App\Services;

use App\Models\Order;
use Illuminate\Support\Facades\DB;

class OrderDocument
{
    public function present(Order $order): array
    {
        // Deliberate print projection: no account IDs, secrets, notes or payment evidence.
        $order->loadMissing('items');
        $payment = DB::table('order_payments')->where('order_id', $order->order_id)->first();
        $evidence = app(PaymentEvidence::class);
        $confirmed = $evidence->valid($order, $payment);
        $sandbox = $payment ? ($confirmed && $evidence->mode($payment) === 'test')
            : ($order->payment_method === 'digital' && \App\Models\PaymentCheckoutAttempt::where('order_id', $order->order_id)->where('store_id', $order->store_id)
                ->whereIn('provider', ['paymongo', 'xendit'])->where('mode', 'test')->exists());
        return [
            ...$order->only(['order_id', 'store_name', 'store_address', 'shopper_name', 'status', 'payment_method', 'payment_status',
                'claim_status', 'subtotal_centavos', 'service_fee_centavos', 'total_centavos', 'currency']),
            'order_reference' => OrderReference::format($order->order_id),
            'created_at' => $order->created_at->toIso8601String(),
            'pickup_window_start_at' => $order->pickup_window_start_at?->toIso8601String(),
            'pickup_window_end_at' => $order->pickup_window_end_at?->toIso8601String(),
            'payment_confirmed' => $confirmed,
            'payment_display_status' => $order->payment_status === 'paid' ? ($confirmed ? 'Paid' : 'Recorded / evidence review') : 'Pending / Unpaid',
            'sandbox' => $sandbox,
            'items' => $order->items->map(fn ($item) => $item->only(['product_name', 'size', 'selling_unit', 'quantity', 'unit_price_centavos', 'line_total_centavos']))->values()->all(),
        ];
    }
}
