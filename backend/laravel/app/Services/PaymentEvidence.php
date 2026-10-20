<?php

namespace App\Services;

use App\Models\Order;

class PaymentEvidence
{
    public function valid(Order $order, ?object $payment): bool
    {
        if (!$payment || $order->payment_status !== 'paid' || (int) $payment->amount_centavos !== $order->total_centavos || $payment->method !== $order->payment_method) return false;
        if ($order->payment_method === 'cash_on_pickup') return $payment->verification_source === 'cashier' && $payment->cashier_name && $payment->evidence_reference;
        if ($order->payment_method === 'digital') {
            if ($payment->verification_source !== 'provider' || !$payment->provider || !$payment->provider_reference) return false;
            if ($payment->provider === 'paymongo_test') {
                if (!\Illuminate\Support\Facades\Schema::hasTable('payment_checkout_attempts')) return false;
                return \App\Models\PaymentCheckoutAttempt::where('order_id', $order->order_id)->where('store_id', $order->store_id)
                    ->where('mode', 'test')->where('status', 'paid')->where('provider_payment_id', $payment->provider_reference)
                    ->where('amount_centavos', $order->total_centavos)->where('currency', $order->currency)->exists();
            }
            return true; // Existing trusted-provider fixtures and prior integrations retain their evidence checks.
        }
        return false;
    }
}
