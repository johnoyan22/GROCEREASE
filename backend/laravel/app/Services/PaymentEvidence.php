<?php

namespace App\Services;

use App\Models\Order;

class PaymentEvidence
{
    public function valid(Order $order, ?object $payment): bool
    {
        if (!$payment || $order->payment_status !== 'paid' || (int) $payment->amount_centavos !== $order->total_centavos || $payment->method !== $order->payment_method) return false;
        if ($order->payment_method === 'cash_on_pickup') return $payment->verification_source === 'cashier' && $payment->cashier_name && $payment->evidence_reference;
        if ($order->payment_method === 'digital') return $payment->verification_source === 'provider' && $payment->provider && $payment->provider_reference;
        return false;
    }
}
