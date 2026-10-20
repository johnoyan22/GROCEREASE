<?php

namespace App\Services;

use App\Models\Store;
use App\Models\StoreInventory;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rule;

class CheckoutPricing
{
    public function validatedCart(Request $request): array
    {
        $validated = $request->validate([
            ...app(PickupScheduling::class)->selectionRules(),
            'store_id' => ['required', 'integer', 'min:1'],
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*' => ['required', 'array:store_inventory_id,quantity'],
            'items.*.store_inventory_id' => ['required', 'integer', 'min:1', 'distinct'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:2147483647'],
            'shopper_user_id' => ['prohibited'], 'user_id' => ['prohibited'], 'role' => ['prohibited'],
            'subtotal' => ['prohibited'], 'total' => ['prohibited'], 'price' => ['prohibited'],
            'subtotal_centavos' => ['prohibited'], 'total_centavos' => ['prohibited'],
            'service_fee_centavos' => ['prohibited'], 'service_fee_policy' => ['prohibited'],
            'payment_status' => ['prohibited'], 'payment_method' => ['sometimes', Rule::in(['cash_on_pickup', 'digital'])],
            'payment_channel' => ['sometimes', Rule::in(['wallet', 'card'])],
            'provider_reference' => ['prohibited'], 'provider' => ['prohibited'], 'amount' => ['prohibited'],
            'status' => ['prohibited'], 'reservation_status' => ['prohibited'],
        ]);
        $items = [];
        foreach ($validated['items'] as $item) {
            $items[] = ['store_inventory_id' => (int) $item['store_inventory_id'], 'quantity' => (int) $item['quantity']];
        }
        usort($items, function ($first, $second) {
            return $first['store_inventory_id'] <=> $second['store_inventory_id'];
        });
        return ['store_id' => (int) $validated['store_id'], 'items' => $items,
            'payment_method' => $validated['payment_method'] ?? 'cash_on_pickup',
            'payment_channel' => ($validated['payment_method'] ?? 'cash_on_pickup') === 'digital' ? ($validated['payment_channel'] ?? 'wallet') : null,
            'pickup_date' => $validated['pickup_date'], 'pickup_start' => $validated['pickup_start'], 'pickup_end' => $validated['pickup_end']];
    }

    public function cartHash(array $cart): string
    {
        return hash('sha256', json_encode($cart));
    }

    // Caller holds a database transaction. All stock writers lock the store before its inventory.
    public function resolve(array $cart): array
    {
        $store = Store::query()->where('status', Store::STATUS_ACTIVE)->lockForUpdate()->findOrFail($cart['store_id']);
        $schedule = app(PickupScheduling::class)->resolve($store, $cart);
        $digital = ($cart['payment_method'] ?? 'cash_on_pickup') === 'digital';
        if ($digital) {
            app(PayMongoGateway::class)->requireSchema();
            $merchant = app(PayMongoGateway::class)->merchant($store->store_id);
            $channels = $cart['payment_channel'] === 'card' ? array_intersect($merchant['methods'], ['card']) : array_diff($merchant['methods'], ['card']);
            abort_unless($channels, 422, 'The selected payment channel is unavailable for this supermarket.');
            abort_unless(in_array($store->paid_order_holding_hours, [24, 48], true), 422, 'The Supervisor must configure the approved 24- or 48-hour prepaid holding policy first.');
        }
        if (config('checkout.service_fee.enabled') !== false) {
            abort(503, 'Service-fee approval and implementation are pending. No charge has been activated.');
        }
        $maximum = $digital ? 4294967295 : (int) config('checkout.cop_max_centavos'); // Existing unsigned centavo columns.
        $subtotal = 0;
        $lines = [];
        foreach ($cart['items'] as $index => $requested) {
            $inventory = StoreInventory::forStore($store->store_id)
                ->whereHas('product', function ($query) use ($store) { $query->forStore($store->store_id); })
                ->where('status', StoreInventory::STATUS_ACTIVE)
                ->whereKey($requested['store_inventory_id'])->lockForUpdate()->first();
            if (! $inventory) {
                $this->invalid($index, 'A product is unavailable in the selected store. Refresh your cart.');
            }
            // Use a current locking read after waiting for the store lock (including on MariaDB).
            $inventory->setRelation('product', Product::forStore($store->store_id)
                ->whereKey($inventory->product_id)->lockForUpdate()->firstOrFail());
            $quantity = $requested['quantity'];
            if ($quantity > $inventory->availableStock()) {
                $this->invalid($index, $inventory->product->product_name.' has insufficient available stock.');
            }
            if ($inventory->max_per_order !== null && $quantity > $inventory->max_per_order) {
                $this->invalid($index, $inventory->product->product_name.' exceeds its maximum units per order.');
            }
            $parts = explode('.', $inventory->selling_price);
            $unitPrice = ((int) $parts[0] * 100) + (int) $parts[1];
            // Check the COP ceiling before multiplication, including extremely large quantities.
            if ($unitPrice > 0 && $quantity > intdiv($maximum, $unitPrice)) {
                $this->invalid($index, $digital ? 'This order exceeds the supported centavo range.' : 'Cash on Pickup orders cannot exceed PHP 1,500.00.');
            }
            $lineTotal = $unitPrice * $quantity;
            $subtotal = $subtotal + $lineTotal;
            if ($subtotal > $maximum) {
                $this->invalid($index, $digital ? 'This order exceeds the supported centavo range.' : 'Cash on Pickup orders cannot exceed PHP 1,500.00.');
            }
            $lines[] = [
                'inventory' => $inventory, 'quantity' => $quantity,
                'product_name' => $inventory->product->product_name, 'sku' => $inventory->product->sku,
                'size' => $inventory->product->size,
                'unit_price_centavos' => $unitPrice, 'line_total_centavos' => $lineTotal,
            ];
        }
        return [
            'store' => $store, 'lines' => $lines, 'subtotal_centavos' => $subtotal,
            'service_fee_centavos' => 0, 'total_centavos' => $subtotal,
            'service_fee_policy' => 'pending_partner_approval_no_charge',
            'schedule' => $schedule,
            'payment_method' => $cart['payment_method'] ?? 'cash_on_pickup', 'payment_channel' => $cart['payment_channel'] ?? null,
        ];
    }

    public function publicQuote(array $pricing): array
    {
        $items = [];
        foreach ($pricing['lines'] as $line) {
            $items[] = [
                'store_inventory_id' => $line['inventory']->store_inventory_id,
                'product_name' => $line['product_name'], 'sku' => $line['sku'], 'size' => $line['size'],
                'quantity' => $line['quantity'], 'unit_price_centavos' => $line['unit_price_centavos'],
                'line_total_centavos' => $line['line_total_centavos'],
            ];
        }
        return [
            'store' => $pricing['store']->only(['store_id', 'store_name', 'address']), 'items' => $items,
            'subtotal_centavos' => $pricing['subtotal_centavos'], 'service_fee_centavos' => $pricing['service_fee_centavos'],
            'total_centavos' => $pricing['total_centavos'], 'currency' => 'PHP',
            'service_fee_policy' => $pricing['service_fee_policy'],
            'payment_method' => $pricing['payment_method'], 'payment_channel' => $pricing['payment_channel'],
            'pickup_window_start_at' => $pricing['schedule']['pickup_window_start_at']->toIso8601String(),
            'pickup_window_end_at' => $pricing['schedule']['pickup_window_end_at']->toIso8601String(),
            'cop_claim_deadline_at' => $pricing['schedule']['scheduled_store_closes_at']->toIso8601String(),
            'timezone' => PickupScheduling::TIMEZONE,
        ];
    }

    public function priceHash(array $pricing): string
    {
        return hash('sha256', json_encode($this->publicQuote($pricing)));
    }

    private function invalid(int $index, string $message): never
    {
        throw ValidationException::withMessages(['items.'.$index.'.quantity' => $message]);
    }
}
