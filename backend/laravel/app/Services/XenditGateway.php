<?php

namespace App\Services;

use App\Models\Order;
use App\Models\PaymentCheckoutAttempt;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;

class XenditGateway
{
    public const CHANNELS = ['GCASH' => 'gcash', 'CARDS' => 'card'];

    public function merchant(int $store, bool $existingAttempt = false): array
    {
        $m = config('payments.xendit');
        abort_unless(is_array($m) && (int) ($m['store_id'] ?? 0) === $store && $store > 0, 503, 'This supermarket has no configured Xendit TEST business.');
        abort_unless(preg_match('/^[a-f0-9]{24}$/D', $m['merchant_id'] ?? '') && str_starts_with($m['secret_key'] ?? '', 'xnd_development_')
            && strlen($m['webhook_secret'] ?? '') >= 16, 503, 'Configure the Xendit TEST business ID, development secret key and callback token on the backend.');
        $codes = $m['channel_codes'] ?? [];
        abort_unless($existingAttempt || (is_array($codes) && count($codes) && count($codes) === count(array_unique($codes)) && !array_diff($codes, array_keys(self::CHANNELS))), 503, 'Configure supported Xendit TEST channels: GCASH, or explicitly authorized CARDS.');
        return $m + ['methods' => array_values(array_map(fn ($code) => self::CHANNELS[$code], array_intersect((array) $codes, array_keys(self::CHANNELS))))];
    }

    public function boundMerchant(PaymentCheckoutAttempt $attempt): array
    {
        $m = $this->merchant($attempt->store_id, true);
        abort_unless($attempt->provider === 'xendit' && $attempt->mode === 'test' && $attempt->merchant_id === $m['merchant_id']
            && hash_equals($attempt->credential_fingerprint, hash('sha256', $m['secret_key'])), 409, 'The pinned Xendit TEST business credentials changed. Reconciliation requires the original configuration.');
        return $m; // New-checkout provider/mode/method switches do not affect existing attempts.
    }

    public function requireSchema(): void
    {
        abort_unless(Schema::hasTable('xendit_session_events'), 503, 'Apply the additive Xendit payment migration first.');
    }

    public function returnUrl(int $order, string $result): string
    {
        $base = rtrim(config('app.frontend_url'), '/'); $url = parse_url($base);
        abort_unless(($url['scheme'] ?? '') === 'https' && !empty($url['host']) && !isset($url['user']) && !isset($url['pass']) && !isset($url['query']) && !isset($url['fragment']), 503,
            'Xendit requires an HTTPS FRONTEND_URL. Configure the single-origin test tunnel first.');
        return $base.'/shopper/dashboard?payment_order='.$order.'&payment_return='.$result;
    }

    public function requireCreationWindow($expires): void
    {
        // 30-second transport margin beyond the documented 10-minute minimum; never extend stock.
        abort_unless($expires->getTimestamp() >= now()->getTimestamp() + 630, 422, 'Too little time remains to start Xendit payment. Cancel safely, then choose a later pickup window and check out again.');
    }

    public function create(Order $order, PaymentCheckoutAttempt $a): array
    {
        $this->requireCreationWindow($a->expires_at);
        $codes = array_keys(array_filter(self::CHANNELS, fn ($method) => in_array($method, $a->channels, true)));
        abort_unless($codes, 409, 'No pinned Xendit channels are allowed.');
        $items = $order->items()->orderBy('order_item_id')->get()->map(fn ($i) => ['reference_id' => 'item-'.$i->order_item_id, 'name' => mb_substr($i->product_name, 0, 255),
            'type' => 'PHYSICAL_PRODUCT', 'category' => 'GROCERIES', 'net_unit_amount' => XenditMoney::decimal($i->unit_price_centavos), 'quantity' => $i->quantity, 'currency' => 'PHP'])->all();
        if ($order->service_fee_centavos) $items[] = ['reference_id' => 'service-fee', 'name' => 'Service charge', 'type' => 'FEE', 'category' => 'SERVICE_FEE',
            'net_unit_amount' => XenditMoney::decimal($order->service_fee_centavos), 'quantity' => 1, 'currency' => 'PHP'];
        return $this->request($this->boundMerchant($a), 'POST', '/sessions', ['reference_id' => $a->provider_reference, 'session_type' => 'PAY', 'mode' => 'PAYMENT_LINK',
            'currency' => 'PHP', 'country' => 'PH', 'amount' => XenditMoney::decimal($a->amount_centavos), 'capture_method' => 'AUTOMATIC', 'allow_save_payment_method' => 'DISABLED',
            'allowed_payment_channels' => $codes, 'expires_at' => $a->expires_at->toIso8601String(), 'locale' => 'en', 'items' => $items,
            'description' => 'GrocerEase TEST grocery order #'.$order->order_id,
            'success_return_url' => $this->returnUrl($order->order_id, 'success'), 'cancel_return_url' => $this->returnUrl($order->order_id, 'cancel')]);
    }

    public function id(mixed $id, string $prefix): string
    {
        $pattern = $prefix === 'ps' ? '/^ps-[a-f0-9]{24}$/D' : '/^'.preg_quote($prefix, '/').'-(?:[a-f0-9]{24}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/D';
        abort_unless(is_string($id) && preg_match($pattern, $id), 409, 'Invalid Xendit '.$prefix.' identifier.');
        return $id;
    }

    public function hostedUrl(string $url, string $session): string
    {
        $p = parse_url($url);
        $validPath = ($p['host'] ?? '') === 'checkout-staging.xendit.co' ? ($p['path'] ?? '') === '/sessions/'.$session
            : (($p['host'] ?? '') === 'dev.xen.to' && preg_match('/^\/[a-zA-Z0-9]{6,64}$/D', $p['path'] ?? ''));
        abort_unless(($p['scheme'] ?? '') === 'https' && $validPath && !isset($p['user']) && !isset($p['pass']) && !isset($p['port'])
            && !isset($p['query']) && !isset($p['fragment']), 502, 'The Xendit TEST hosted URL is invalid. Reconcile the existing session.');
        return $url;
    }

    public function session(PaymentCheckoutAttempt $a, ?string $id = null): array { return $this->request($this->boundMerchant($a), 'GET', '/sessions/'.$this->id($id ?? $a->provider_session_id, 'ps')); }
    public function payment(PaymentCheckoutAttempt $a, string $id): array { return $this->request($this->boundMerchant($a), 'GET', '/v3/payments/'.$this->id($id, 'py')); }
    public function paymentRequest(PaymentCheckoutAttempt $a, string $id): array { return $this->request($this->boundMerchant($a), 'GET', '/v3/payment_requests/'.$this->id($id, 'pr')); }
    public function cancel(PaymentCheckoutAttempt $a): array { return $this->request($this->boundMerchant($a), 'POST', '/sessions/'.$this->id($a->provider_session_id, 'ps').'/cancel'); }
    public function simulate(PaymentCheckoutAttempt $a, string $id): array { return $this->request($this->boundMerchant($a), 'POST', '/v3/payment_requests/'.$this->id($id, 'pr').'/simulate', ['amount' => XenditMoney::decimal($a->amount_centavos)]); }

    private function request(array $m, string $method, string $path, array $payload = []): array
    {
        try {
            $request = Http::withBasicAuth($m['secret_key'], '')->acceptJson()->timeout(8)->connectTimeout(3)->withOptions(['allow_redirects' => false]);
            if (str_starts_with($path, '/v3/')) $request = $request->withHeaders(['api-version' => '2024-11-11']);
            if ($payload) $request = $request->withBody(XenditMoney::encode($payload), 'application/json');
            $response = $request->send($method, 'https://api.xendit.co'.$path);
        } catch (\Throwable) { abort(502, 'Xendit response is uncertain. Reconcile the existing attempt; do not create another session.'); }
        abort_unless($response->successful(), 502, 'Xendit could not verify this TEST request. Check backend configuration and the original attempt in the test dashboard.');
        return XenditMoney::decode($response->body());
    }
}
