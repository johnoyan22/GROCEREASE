<?php

namespace App\Services\AiRecommendation;

use App\Models\AiRecommendationSetting;
use App\Models\Order;
use App\Models\Store;
use App\Models\StoreInventory;
use App\Services\PaymentEvidence;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

// Adapted from Habel's ranking design. All prices and stock come from store_inventory.
class RecommendationEngine
{
    public function catalog(AiRecommendationSetting $settings): Collection
    {
        if (! $settings->enabled || ! Store::active()->whereKey($settings->store_id)->exists()) {
            return collect();
        }

        return StoreInventory::forStore($settings->store_id)->where('status', StoreInventory::STATUS_ACTIVE)
            ->whereColumn('hard_stock_qty', '>', 'soft_stock_qty')
            ->where(fn ($q) => $q->whereNull('max_per_order')->orWhere('max_per_order', '>', 0))
            ->whereHas('product', function ($q) use ($settings) {
                $q->forStore($settings->store_id);
                if ($settings->included_categories) {
                    $q->whereIn('category', $settings->included_categories);
                }
                if ($settings->excluded_categories) {
                    $q->whereNotIn('category', $settings->excluded_categories);
                }
            })->with('product')->orderBy('store_inventory_id')->get()
            ->filter(fn ($p) => $p->availableStock() > 0)
            ->map(fn ($p) => $this->present($p));
    }

    public function recommend(int $userId, array $cartIds, AiRecommendationSetting $settings): array
    {
        if (! $settings->enabled) {
            return ['items' => [], 'source' => 'disabled'];
        }
        $products = $this->catalog($settings);
        $signals = $this->signals($userId, $settings->store_id, $cartIds);
        $ranked = $products->reject(fn ($p) => in_array($p->store_inventory_id, $cartIds, true))
            ->map(fn ($p) => $this->scored($p, $signals, $settings->ranking_basis))
            ->sort(fn ($a, $b) => [$b['score'], $a['product_name'], $a['store_inventory_id']] <=> [$a['score'], $b['product_name'], $b['store_inventory_id']]);

        return ['items' => $ranked->take($settings->max_items)->values()->all(),
            'source' => ! $ranked->count() ? 'empty' : ($settings->ranking_basis !== 'popularity' && $signals['history'] ? 'personalized' : ($signals['popularity'] ? 'popular' : 'available'))];
    }

    public function fromQuery(int $userId, array $parsed, AiRecommendationSetting $settings): array
    {
        if (! $settings->enabled) {
            return ['items' => [], 'total' => 0, 'source' => 'disabled'];
        }
        $ids = $parsed['product_ids'] ?? [];
        $keywords = $parsed['keywords'] ?? [];
        // Re-read after provider latency. Do not trust its prices, identifiers or stock.
        $matches = $this->catalog($settings)->filter(function ($p) use ($ids, $keywords) {
            if ($ids !== []) {
                return in_array($p->product_id, $ids, true);
            }
            $haystack = mb_strtolower($p->product_name.' '.$p->category);
            foreach ($keywords as $word) {
                if (str_contains($haystack, $word)) {
                    return true;
                }
            }

            return false;
        });
        $affordable = $parsed['affordable'] ?? false;
        if ($affordable && $ids === [] && $keywords === []) {
            $matches = $this->catalog($settings);
        }
        $signals = $this->signals($userId, $settings->store_id, []);
        $matches = $matches->sortBy(function ($p) use ($affordable, $ids, $signals, $settings) {
            if ($affordable) {
                return [$this->centavos($p->selling_price), $p->store_inventory_id];
            }
            if ($ids !== []) {
                return [array_search($p->product_id, $ids, true), $p->store_inventory_id];
            }

            return [-$this->scored($p, $signals, $settings->ranking_basis)['score'], $p->product_name, $p->store_inventory_id];
        });
        $budget = isset($parsed['budget']) ? (int) round($parsed['budget'] * 100) : null;
        $total = 0;
        $items = [];
        foreach ($matches as $item) {
            if (count($items) >= $settings->max_items) {
                break;
            }
            // One unit per match is a shopping starting point, never a serving/nutrition claim.
            $price = $this->centavos($item->selling_price);
            if ($budget !== null && $total + $price > $budget) {
                continue;
            }
            $items[] = (array) $item + ['quantity' => 1, 'line_total' => $price / 100, 'reason' => 'Matches your request'];
            $total += $price;
        }

        return ['items' => $items, 'total' => $total / 100, 'source' => $items ? 'matched' : 'no_match'];
    }

    public function alternatives(int $inventoryId, AiRecommendationSetting $settings): array
    {
        $target = StoreInventory::forStore($settings->store_id)->whereHas('product', fn ($q) => $q->forStore($settings->store_id))
            ->with('product')->findOrFail($inventoryId);
        if (! $settings->enabled || ! $settings->include_alternatives) {
            return [];
        }

        return $this->catalog($settings)->reject(fn ($p) => $p->store_inventory_id === $inventoryId)
            ->filter(fn ($p) => $p->category === $target->product->category)
            ->sortBy(fn ($p) => [abs($this->centavos($p->selling_price) - $this->centavos($target->selling_price)), $p->store_inventory_id])
            ->take($settings->max_items)->map(fn ($p) => (array) $p + ['reason' => 'Same category, closest current price'])->values()->all();
    }

    private function signals(int $userId, int $storeId, array $cartIds): array
    {
        // Completion is physical handover, paid with trusted evidence, fulfilled reservation.
        $orders = Order::where('store_id', $storeId)->where('status', 'completed')->where('claim_status', 'completed')
            ->where('payment_status', 'paid')->where('reservation_status', 'fulfilled')->whereNotNull('completed_at')
            ->whereNull('canceled_at')->whereNull('unclaimed_at')
            ->whereExists(fn ($q) => $q->selectRaw('1')->from('order_handovers')->whereColumn('order_handovers.order_id', 'orders.order_id'))->get();
        $payments = DB::table('order_payments')->whereIn('order_id', $orders->pluck('order_id'))->get()->keyBy('order_id');
        $valid = $orders->filter(fn ($o) => app(PaymentEvidence::class)->valid($o, $payments->get($o->order_id)));
        $items = DB::table('order_items as oi')->join('store_inventory as si', 'si.store_inventory_id', '=', 'oi.store_inventory_id')
            ->join('products as p', 'p.product_id', '=', 'si.product_id')
            ->where('oi.store_id', $storeId)->where('si.store_id', $storeId)->where('p.store_id', $storeId)
            ->whereIn('oi.order_id', $valid->pluck('order_id'))->get(['oi.order_id', 'oi.store_inventory_id', 'oi.quantity', 'p.category']);
        $ownOrders = $valid->where('shopper_user_id', $userId)->pluck('order_id')->all();
        $history = [];
        $categories = [];
        $popularity = [];
        foreach ($items as $item) {
            $id = $item->store_inventory_id;
            $popularity[$id] = ($popularity[$id] ?? 0) + $item->quantity;
            if (in_array($item->order_id, $ownOrders, true)) {
                $history[$id] = ($history[$id] ?? 0) + $item->quantity;
                $categories[$item->category] = ($categories[$item->category] ?? 0) + $item->quantity;
            }
        }
        $cartCategories = StoreInventory::forStore($storeId)->whereIn('store_inventory_id', $cartIds)
            ->whereHas('product', fn ($q) => $q->forStore($storeId))->with('product')->get()->map(fn ($p) => $p->product->category)->all();

        return compact('history', 'categories', 'popularity', 'cartCategories');
    }

    private function scored(object $p, array $s, string $basis): array
    {
        $bought = $s['history'][$p->store_inventory_id] ?? 0;
        $category = $s['categories'][$p->category] ?? 0;
        $popular = $s['popularity'][$p->store_inventory_id] ?? 0;
        $popularity = $s['popularity'] ? $popular / max($s['popularity']) : 0;
        $cart = in_array($p->category, $s['cartCategories'], true);
        $history = ($bought ? 3 : 0) + ($category ? 2 : 0);
        $score = match ($basis) {
            'popularity' => $popularity, 'purchase_history' => $s['history'] ? $history : $popularity, default => $history + $popularity + ($cart ? 1.5 : 0)
        };
        $reason = $basis !== 'popularity' && $bought ? 'You bought this in a completed purchase' :
            ($basis !== 'popularity' && $category ? 'Matches categories you purchased' :
            ($basis === 'hybrid' && $cart ? 'Similar to items in your cart' : ($popular ? 'Popular in completed store purchases' : 'Available in this store')));

        return (array) $p + ['score' => round($score, 3), 'reason' => $reason];
    }

    private function present(StoreInventory $p): object
    {
        return (object) ['store_inventory_id' => $p->store_inventory_id, 'store_id' => $p->store_id,
            'product_id' => $p->product_id, 'product_name' => $p->product->product_name, 'name' => $p->product->product_name,
            'category' => $p->product->category, 'size' => $p->product->size, 'selling_price' => $p->selling_price,
            'selling_unit' => $p->product->selling_unit, 'image_url' => $p->product->imageUrl(),
            'sku' => $p->product->sku, 'barcode' => $p->product->barcode, 'is_low_stock' => $p->isLowStock(),
            'available_stock' => $p->availableStock(), 'max_per_order' => $p->max_per_order, 'stock_version' => $p->stock_version];
    }

    private function centavos(string $price): int
    {
        $parts = explode('.', $price);

        return (int) $parts[0] * 100 + (int) str_pad($parts[1] ?? '', 2, '0');
    }
}
