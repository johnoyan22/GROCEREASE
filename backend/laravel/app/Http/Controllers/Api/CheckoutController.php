<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\User;
use App\Services\CheckoutPricing;
use App\Services\OrderData;
use App\Services\CopRestrictions;
use App\Services\PickupScheduling;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use JsonException;

class CheckoutController extends Controller
{
    public function findAttempt(Request $request, string $key, OrderData $data): JsonResponse
    {
        return DB::transaction(function () use ($request, $key, $data) {
            $user = $this->shopper($request);
            $data->requireSchema();
            $order = Order::where('shopper_user_id', $user->id)
                ->where('idempotency_key', strtolower($key))->firstOrFail();
            return response()->json(['order' => $data->present($order)]);
        }, 3);
    }

    public function quote(Request $request, CheckoutPricing $pricing, OrderData $data): JsonResponse
    {
        $cart = $pricing->validatedCart($request);
        return DB::transaction(function () use ($request, $pricing, $data, $cart) {
            $user = $this->shopper($request);
            $data->requireSchema();
            app(PickupScheduling::class)->requireSchema();
            if ($cart['payment_method'] === 'cash_on_pickup') app(CopRestrictions::class)->requireAllowed($user->id);
            $resolved = $pricing->resolve($cart);
            $expiresAt = now()->addSeconds((int) config('checkout.quote_lifetime_seconds'));
            $token = Crypt::encryptString(json_encode([
                'shopper_user_id' => $user->id, 'cart_hash' => $pricing->cartHash($cart),
                'price_hash' => $pricing->priceHash($resolved), 'expires_at' => $expiresAt->timestamp,
            ]));
            return response()->json([
                'quote' => $pricing->publicQuote($resolved),
                'quote_token' => $token, 'expires_at' => $expiresAt->toIso8601String(),
            ]);
        }, 3);
    }

    public function store(Request $request, CheckoutPricing $pricing, OrderData $data): JsonResponse
    {
        $cart = $pricing->validatedCart($request);
        $validated = $request->validate([
            'idempotency_key' => ['required', 'uuid'], 'quote_token' => ['required', 'string', 'max:32768'],
        ]);
        return DB::transaction(function () use ($request, $pricing, $data, $cart, $validated) {
            // Serializes retries from the same account before checking the unique key.
            $user = $this->shopper($request);
            $data->requireSchema();
            $key = strtolower($validated['idempotency_key']);
            $hash = $pricing->cartHash($cart);
            $existing = Order::where('shopper_user_id', $user->id)->where('idempotency_key', $key)->first();
            if ($existing) {
                if ($existing->request_hash !== $hash) {
                    abort(409, 'This checkout key was already used for a different cart.');
                }
                return response()->json(['message' => 'This order was already placed.', 'order' => $data->present($existing)]);
            }

            $quote = $this->readQuote($validated['quote_token']);
            if (($quote['shopper_user_id'] ?? null) !== $user->id || ($quote['cart_hash'] ?? null) !== $hash) {
                throw ValidationException::withMessages(['quote_token' => 'This quote does not belong to your cart and account.']);
            }
            if (($quote['expires_at'] ?? 0) <= now()->timestamp) {
                abort(409, 'Your checkout review expired. Review the current prices again.');
            }
            $resolved = $pricing->resolve($cart);
            if ($cart['payment_method'] === 'cash_on_pickup') app(CopRestrictions::class)->requireAllowed($user->id);
            if (($quote['price_hash'] ?? '') !== $pricing->priceHash($resolved)) {
                abort(409, 'Store details or prices changed. Review the updated checkout before placing your order.');
            }

            $store = $resolved['store'];
            $name = trim(($user->profile?->first_name ?? '').' '.($user->profile?->last_name ?? ''));
            if ($name === '') $name = 'Shopper #'.$user->id;
            $order = Order::create([
                ...$resolved['schedule'],
                'store_id' => $store->store_id, 'shopper_user_id' => $user->id,
                'store_name' => $store->store_name, 'store_address' => $store->address,
                'shopper_name' => mb_substr($name, 0, 255),
                'status' => 'waiting', 'payment_method' => $cart['payment_method'], 'payment_status' => 'unpaid',
                'reservation_status' => 'active', 'currency' => 'PHP',
                'subtotal_centavos' => $resolved['subtotal_centavos'], 'service_fee_centavos' => $resolved['service_fee_centavos'],
                'total_centavos' => $resolved['total_centavos'], 'service_fee_policy' => $resolved['service_fee_policy'],
                'idempotency_key' => $key, 'request_hash' => $hash,
            ]);
            foreach ($resolved['lines'] as $line) {
                $inventory = $line['inventory'];
                OrderItem::create([
                    'order_id' => $order->order_id, 'store_id' => $store->store_id,
                    'store_inventory_id' => $inventory->store_inventory_id,
                    'product_name' => $line['product_name'], 'sku' => $line['sku'], 'size' => $line['size'],
                    'quantity' => $line['quantity'], 'unit_price_centavos' => $line['unit_price_centavos'],
                    'line_total_centavos' => $line['line_total_centavos'],
                ]);
                $inventory->soft_stock_qty = $inventory->soft_stock_qty + $line['quantity'];
                $inventory->stock_version = $inventory->stock_version + 1;
                $inventory->save();
            }
            if ($cart['payment_method'] === 'digital') app(\App\Services\PaymentCheckout::class)->createAttempt($order, $cart['payment_channel']);
            OrderStatusHistory::create([
                'order_id' => $order->order_id, 'changed_by_user_id' => $user->id,
                'previous_status' => null, 'new_status' => 'waiting', 'note' => $cart['payment_method'] === 'digital' ? 'Sandbox digital order reserved; payment pending trusted provider confirmation.' : 'Cash on Pickup order placed; payment remains unpaid.',
            ]);
            return response()->json([
                'message' => $cart['payment_method'] === 'digital' ? 'Order reserved. Complete the sandbox hosted payment before preparation.' : 'Order placed. Pay the store cashier before final pickup release.',
                'order' => $data->present($order->refresh()),
            ], 201);
        }, 3);
    }

    private function shopper(Request $request): User
    {
        $user = User::with(['role', 'profile'])->lockForUpdate()->findOrFail($request->user()->id);
        if (($user->account_status ?? 'active') !== 'active' || $user->role?->slug !== 'shopper' || ! $user->hasVerifiedEmail()) {
            abort(403, 'A verified Shopper account is required.');
        }
        return $user;
    }

    private function readQuote(string $token): array
    {
        try {
            $quote = json_decode(Crypt::decryptString($token), true, 512, JSON_THROW_ON_ERROR);
            if (is_array($quote)) return $quote;
        } catch (DecryptException|JsonException) {
            // Return a field error without leaking encryption details.
        }
        throw ValidationException::withMessages(['quote_token' => 'The checkout review is invalid. Review your cart again.']);
    }
}
