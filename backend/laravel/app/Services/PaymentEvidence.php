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
            if (in_array($payment->provider, ['paymongo_test', 'xendit_test'], true)) {
                if (!\Illuminate\Support\Facades\Schema::hasTable('payment_checkout_attempts')) return false;
                $attempt = \App\Models\PaymentCheckoutAttempt::where('order_id', $order->order_id)->where('store_id', $order->store_id)
                    ->where('provider', $payment->provider === 'xendit_test' ? 'xendit' : 'paymongo')
                    ->where('mode', 'test')->where('status', 'paid')->where('provider_payment_id', $payment->provider_reference)
                    ->where('amount_centavos', $order->total_centavos)->where('currency', $order->currency)->first();
                if (!$attempt) return false;
                if ($payment->provider === 'paymongo_test') return true; // Existing pinned legacy attempts keep their original evidence contract.
                $e=$attempt->verified_evidence ?? [];
                try { $reference=\Illuminate\Support\Facades\Crypt::decryptString($payment->evidence_reference); } catch (\Throwable) { return false; }
                return $attempt->verified_at && $payment->evidence_type === 'xendit_session_v3_capture' && $reference === $attempt->id
                    && ($e['business_id']??null)===$attempt->merchant_id && ($e['session_id']??null)===$attempt->provider_session_id
                    && ($e['request_id']??null)===$attempt->provider_request_id && ($e['payment_id']??null)===$attempt->provider_payment_id
                    && !empty($attempt->provider_capture_id) && ($e['capture_id']??null)===$attempt->provider_capture_id
                    && ($e['reference_id']??null)===$attempt->provider_reference && ($e['amount_centavos']??null)===$order->total_centavos
                    && is_string($e['payment_reference_id']??null) && $e['payment_reference_id']!==''
                    && ($e['currency']??null)==='PHP' && ($e['status']??null)==='SUCCEEDED' && ($e['type']??null)==='PAY'
                    && in_array(XenditGateway::CHANNELS[$e['channel']??'']??null,$attempt->channels,true);
            }
            return false; // Unknown providers cannot establish trusted payment or authorize pickup.
        }
        return false;
    }

    public function mode(object $payment): string
    {
        if ($payment->method === 'cash_on_pickup') return 'actual';
        return in_array($payment->provider, ['paymongo_test', 'xendit_test'], true) ? 'test' : 'legacy';
    }
}
