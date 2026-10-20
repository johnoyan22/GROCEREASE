<?php

namespace App\Services;

use App\Models\Order;
use App\Models\PaymentCheckoutAttempt;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpKernel\Exception\HttpException;

class PayMongoGateway
{
    public function merchant(int $storeId): array
    {
        abort_unless(config('payments.mode') === 'test', 503, 'Digital payment is unavailable. Only an authorized test gateway can be enabled.');
        $merchant = config('payments.merchants.'.$storeId);
        abort_unless(is_array($merchant) && preg_match('/^org_[a-zA-Z0-9]+$/', $merchant['merchant_id'] ?? '')
            && str_starts_with($merchant['secret_key'] ?? '', 'sk_test_') && !empty($merchant['webhook_secret']), 503, 'This supermarket has no authorized PayMongo test merchant configuration.');
        $methods = $merchant['methods'] ?? [];
        abort_unless(is_array($methods) && count($methods) > 0 && !array_diff($methods, ['card', 'gcash', 'paymaya', 'grab_pay', 'qrph', 'shopee_pay']), 503, 'Configure the payment channels enabled for this test merchant.');
        foreach (config('payments.merchants', []) as $otherId => $other) {
            if ((int) $otherId !== $storeId && (($other['secret_key'] ?? null) === $merchant['secret_key'] || ($other['merchant_id'] ?? null) === $merchant['merchant_id'])) {
                abort(503, 'A sandbox merchant must be explicitly isolated to one supermarket.');
            }
        }
        return $merchant;
    }

    public function requireSchema(): void
    {
        abort_unless(Schema::hasTable('payment_checkout_attempts') && Schema::hasTable('payment_webhook_events'), 503, 'Digital payment is awaiting the reviewed payment migration.');
    }

    public function options(int $storeId): array
    {
        try {
            $merchant = $this->merchant($storeId);
            $this->requireSchema();
            return ['available' => true, 'mode' => 'test', 'channels' => $merchant['methods'], 'reason' => null];
        } catch (HttpException $error) {
            return ['available' => false, 'mode' => 'disabled', 'channels' => [], 'reason' => $error->getMessage()];
        }
    }

    public function boundMerchant(PaymentCheckoutAttempt $attempt): array
    {
        $merchant = $this->merchant($attempt->store_id);
        abort_unless($attempt->mode === 'test' && $attempt->merchant_id === $merchant['merchant_id']
            && hash_equals($attempt->credential_fingerprint, hash('sha256', $merchant['secret_key'])), 409, 'The payment merchant configuration changed; reconciliation is required.');
        return $merchant;
    }

    public function create(Order $order, PaymentCheckoutAttempt $attempt): array
    {
        $merchant = $this->boundMerchant($attempt);
        $return = rtrim(config('app.frontend_url'), '/').'/shopper/dashboard';
        $items = $order->items()->orderBy('order_item_id')->get()->map(fn ($item) => [
            'name' => $item->product_name, 'amount' => $item->unit_price_centavos, 'quantity' => $item->quantity, 'currency' => 'PHP',
        ])->all();
        return $this->request($merchant, 'POST', '/v2/checkout_sessions', ['data' => ['attributes' => [
            'line_items' => $items, 'payment_method_types' => $attempt->channels,
            'reference_number' => 'GE-'.$order->order_id.'-'.$attempt->id,
            'metadata' => $this->metadata($order, $attempt), 'description' => 'GrocerEase sandbox order #'.$order->order_id,
            'send_email_receipt' => false, 'show_description' => true, 'show_line_items' => true,
            'success_url' => $return.'?payment_return=success', 'cancel_url' => $return.'?payment_return=cancel',
        ]]]);
    }

    public function retrieve(PaymentCheckoutAttempt $attempt, ?string $sessionId = null): array
    {
        $id = $sessionId ?? $attempt->provider_session_id;
        abort_unless(is_string($id) && preg_match('/^cs_[a-zA-Z0-9]+$/', $id), 409, 'A valid provider session is required for reconciliation.');
        return $this->request($this->boundMerchant($attempt), 'GET', '/v1/checkout_sessions/'.$id);
    }

    public function expire(PaymentCheckoutAttempt $attempt): array
    {
        return $this->request($this->boundMerchant($attempt), 'POST', '/v1/checkout_sessions/'.$attempt->provider_session_id.'/expire');
    }

    public function metadata(Order $order, PaymentCheckoutAttempt $attempt): array
    {
        return ['order_id' => (string) $order->order_id, 'store_id' => (string) $order->store_id,
            'attempt_id' => $attempt->id, 'merchant_id' => $attempt->merchant_id];
    }

    private function request(array $merchant, string $method, string $path, array $payload = []): array
    {
        try {
            // No automatic POST retry: Checkout Session idempotency is not assumed.
            $response = Http::withBasicAuth($merchant['secret_key'], '')->acceptJson()->asJson()->timeout(15)->connectTimeout(5)
                ->withOptions(['allow_redirects' => false])->send($method, 'https://api.paymongo.com'.$path, $payload ? ['json' => $payload] : []);
        } catch (ConnectionException) {
            abort(502, 'Payment provider response is uncertain. Recover the existing attempt; do not create another checkout.');
        }
        abort_unless($response->successful(), $response->status() >= 500 ? 502 : 409, 'The sandbox provider could not complete this request. Check the original payment attempt.');
        $data = $response->json('data');
        abort_unless(is_array($data), 502, 'The sandbox provider returned an invalid response. Reconciliation is required.');
        return $data;
    }
}
