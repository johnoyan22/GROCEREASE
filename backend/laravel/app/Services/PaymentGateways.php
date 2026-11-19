<?php

namespace App\Services;

use Symfony\Component\HttpKernel\Exception\HttpException;

class PaymentGateways
{
    public const METHODS = ['gcash', 'card', 'paymaya', 'grab_pay', 'qrph', 'shopee_pay'];

    public function selected(): PayMongoGateway|XenditGateway
    {
        return match (config('payments.provider')) {
            'xendit' => app(XenditGateway::class),
            'paymongo' => app(PayMongoGateway::class),
            default => abort(503, 'Configure a supported TEST payment provider.'),
        };
    }

    public function merchant(int $store): array
    {
        abort_unless(config('payments.mode') === 'test', 503, 'New digital checkout requires TEST mode. Live payments are not supported.');
        return $this->selected()->merchant($store);
    }

    public function options(int $store): array
    {
        try {
            $gateway = $this->selected();
            $merchant = $this->merchant($store); $gateway->requireSchema();
            if ($gateway instanceof XenditGateway) $gateway->returnUrl(1, 'success');
            $policy = app(FinancialPolicy::class)->current($store);
            $methods = app(FinancialPolicy::class)->methods($policy, $merchant['methods']);
            $unsupported = array_values(array_diff($policy['digital_methods'] ?? [], $merchant['methods']));
            return ['available' => count($methods) > 0, 'mode' => 'test', 'provider' => config('payments.provider'),
                'label' => config('payments.provider') === 'xendit' ? 'Xendit (Test)' : 'PayMongo (Test)', 'channels' => $methods,
                'reason' => $methods ? null : 'No configured digital methods are allowed by this store policy.',
                'policy_warning' => $unsupported ? 'Saved methods unsupported by this provider: '.implode(', ', $unsupported).'. Review the payment rules; no extra methods were enabled.' : null,
                'configuration_status' => 'Configured locally; external connection not verified.'];
        } catch (HttpException $e) {
            return ['available' => false, 'mode' => 'disabled', 'provider' => config('payments.provider'), 'channels' => [], 'reason' => $e->getMessage()];
        }
    }
}
