<?php

namespace App\Services\AiRecommendation;

use App\Models\AiRecommendationSetting;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Reads the shared tables (products, orders, order_items) through the query
 * builder, so it does not depend on a teammate's Eloquent models. Every table
 * or column it needs is checked first, so missing pieces degrade gracefully.
 */
class RecommendationEngine
{
    private const UNAVAILABLE_STATUSES = ['Out of Stock', 'Archived'];

    // ASSUMPTION: one unit of a product serves about 2 people. Confirm with the team.
    private const PEOPLE_PER_UNIT = 2;

    /**
     * Personalized "Recommendation for you" cards.
     *
     * @param  list<int>  $cartProductIds
     */
    public function recommend(int $userId, array $cartProductIds, AiRecommendationSetting $settings): array
    {
        if (! $settings->enabled) {
            return ['items' => [], 'source' => 'disabled'];
        }

        $products = $this->availableProducts($settings)
            ->reject(fn ($p) => in_array((int) $p->product_id, $cartProductIds, true));

        if ($products->isEmpty()) {
            return ['items' => [], 'source' => 'empty'];
        }

        $signals = $this->signals($userId, $cartProductIds);
        $ranked = $this->rank($products, $signals, $settings->ranking_basis);

        $personalized = $settings->ranking_basis !== 'popularity' && $signals['history'] !== [];

        return [
            'items' => $ranked->take($settings->max_items)->values()->all(),
            'source' => $personalized ? 'personalized' : 'popular',
        ];
    }

    /**
     * Build a basket from a parsed free-text request (budget, headcount, keywords).
     *
     * @param  array{budget: ?float, headcount: ?int, keywords: list<string>}  $parsed
     */
    public function fromQuery(int $userId, array $parsed, AiRecommendationSetting $settings): array
    {
        if (! $settings->enabled) {
            return ['items' => [], 'total' => 0.0, 'source' => 'disabled'];
        }

        $keywords = $parsed['keywords'] ?? [];
        $aiIds = $parsed['product_ids'] ?? [];

        $matches = $this->availableProducts($settings)->filter(function ($p) use ($keywords, $aiIds) {
            // Ids picked by the AI were already checked against this same catalogue.
            if ($aiIds !== []) {
                return in_array((int) $p->product_id, $aiIds, true);
            }

            $haystack = mb_strtolower($p->name . ' ' . $p->category);
            foreach ($keywords as $keyword) {
                if (str_contains($haystack, $keyword)) {
                    return true;
                }
            }

            return false;
        });

        $ranked = $this->rank($matches, $this->signals($userId, []), $settings->ranking_basis);

        if ($aiIds !== []) {
            // Keep the order the AI chose (most relevant first).
            $order = array_flip($aiIds);
            $ranked = $ranked->sortBy(fn ($item) => $order[$item['product_id']] ?? PHP_INT_MAX)->values();
        }

        $perItem = $parsed['headcount'] !== null
            ? max(1, (int) ceil($parsed['headcount'] / self::PEOPLE_PER_UNIT))
            : 1;
        $budget = $parsed['budget'];

        $basket = [];
        $total = 0.0;

        foreach ($ranked as $item) {
            if (count($basket) >= $settings->max_items) {
                break;
            }

            $quantity = min($perItem, $item['stock_quantity']);
            $line = $quantity * $item['selling_price'];

            if ($budget !== null && $total + $line > $budget) {
                $quantity = 1;
                $line = $item['selling_price'];

                if ($total + $line > $budget) {
                    continue;
                }
            }

            $basket[] = $item + ['quantity' => $quantity, 'line_total' => round($line, 2)];
            $total += $line;
        }

        return [
            'items' => $basket,
            'total' => round($total, 2),
            'source' => $matches->isEmpty() ? 'no_match' : 'matched',
        ];
    }

    /**
     * The in-stock, allowed products the AI may choose from.
     */
    public function catalog(AiRecommendationSetting $settings): Collection
    {
        return $settings->enabled ? $this->availableProducts($settings) : collect();
    }

    /**
     * Available products in the same category, closest in price first.
     * Returns null when the product does not exist.
     */
    public function alternatives(int $productId, AiRecommendationSetting $settings): ?array
    {
        if (! Schema::hasTable('products')) {
            return null;
        }

        $product = DB::table('products')->where('product_id', $productId)->first();

        if (! $product) {
            return null;
        }

        if (! $settings->enabled || ! $settings->include_alternatives) {
            return [];
        }

        return $this->availableProducts($settings)
            ->reject(fn ($p) => (int) $p->product_id === $productId)
            ->filter(fn ($p) => $p->category === $product->category)
            ->sortBy(fn ($p) => abs((float) $p->selling_price - (float) $product->selling_price))
            ->take($settings->max_items)
            ->map(fn ($p) => $this->present($p, 'Same category, available now', 0))
            ->values()
            ->all();
    }

    private function availableProducts(AiRecommendationSetting $settings): Collection
    {
        if (! Schema::hasTable('products')) {
            return collect();
        }

        $query = DB::table('products')
            ->where('stock_quantity', '>', 0)
            ->whereNotIn('status', self::UNAVAILABLE_STATUSES);

        if (! empty($settings->included_categories)) {
            $query->whereIn('category', $settings->included_categories);
        }

        if (! empty($settings->excluded_categories)) {
            $query->whereNotIn('category', $settings->excluded_categories);
        }

        return $query->get();
    }

    private function signals(int $userId, array $cartProductIds): array
    {
        $history = $this->history($userId);

        $categoryOf = $history === []
            ? collect()
            : DB::table('products')->whereIn('product_id', array_keys($history))->pluck('category', 'product_id');

        $historyCategories = [];
        foreach ($history as $productId => $quantity) {
            $category = $categoryOf[$productId] ?? null;
            if ($category !== null) {
                $historyCategories[$category] = ($historyCategories[$category] ?? 0) + $quantity;
            }
        }

        $popularity = $this->popularity();

        $cartCategories = $cartProductIds === [] || ! Schema::hasTable('products')
            ? []
            : DB::table('products')->whereIn('product_id', $cartProductIds)->pluck('category')->flip()->all();

        return [
            'history' => $history,
            'historyCategories' => $historyCategories,
            'popularity' => $popularity,
            'maxPopularity' => $popularity === [] ? 0 : max($popularity),
            'cartCategories' => $cartCategories,
        ];
    }

    /**
     * product_id => quantity this shopper bought. Needs orders.user_id, which
     * does not exist yet, so new or unlinked shoppers simply have no history.
     */
    private function history(int $userId): array
    {
        if (
            ! Schema::hasTable('orders')
            || ! Schema::hasTable('order_items')
            || ! Schema::hasColumn('orders', 'user_id')
        ) {
            return [];
        }

        return DB::table('order_items as oi')
            ->join('orders as o', 'o.id', '=', 'oi.order_id')
            ->where('o.user_id', $userId)
            ->select('oi.product_id', DB::raw('SUM(oi.quantity) as qty'))
            ->groupBy('oi.product_id')
            ->pluck('qty', 'product_id')
            ->map(fn ($qty) => (int) $qty)
            ->all();
    }

    /** product_id => total quantity ordered by everyone. */
    private function popularity(): array
    {
        if (! Schema::hasTable('order_items')) {
            return [];
        }

        return DB::table('order_items')
            ->select('product_id', DB::raw('SUM(quantity) as qty'))
            ->groupBy('product_id')
            ->pluck('qty', 'product_id')
            ->map(fn ($qty) => (int) $qty)
            ->all();
    }

    private function rank(Collection $products, array $signals, string $basis): Collection
    {
        return $products
            ->map(fn ($p) => $this->scored($p, $signals, $basis))
            ->sort(fn ($a, $b) => [$b['score'], $a['name']] <=> [$a['score'], $b['name']])
            ->values();
    }

    private function scored(object $p, array $signals, string $basis): array
    {
        $id = (int) $p->product_id;
        $bought = $signals['history'][$id] ?? 0;
        $categoryBought = $signals['historyCategories'][$p->category] ?? 0;
        $orderedQty = $signals['popularity'][$id] ?? 0;
        $popularity = $signals['maxPopularity'] > 0 ? $orderedQty / $signals['maxPopularity'] : 0;
        $inCartCategory = isset($signals['cartCategories'][$p->category]);
        $hasHistory = $signals['history'] !== [];

        $historyScore = ($bought > 0 ? 3 : 0) + ($categoryBought > 0 ? 2 : 0);

        $score = match ($basis) {
            'popularity' => $popularity,
            // New users have no history, so fall back to popularity.
            'purchase_history' => $hasHistory ? $historyScore : $popularity,
            default => $historyScore + $popularity + ($inCartCategory ? 1.5 : 0),
        };

        if ($basis !== 'popularity' && $bought > 0) {
            $reason = 'You have bought this before';
        } elseif ($basis !== 'popularity' && $categoryBought > 0) {
            $reason = 'Matches categories you buy often';
        } elseif ($basis === 'hybrid' && $inCartCategory) {
            $reason = 'Similar to items in your cart';
        } elseif ($orderedQty > 0) {
            $reason = 'Popular with shoppers';
        } else {
            $reason = 'Available now';
        }

        return $this->present($p, $reason, $score);
    }

    private function present(object $p, string $reason, float|int $score): array
    {
        return [
            'product_id' => (int) $p->product_id,
            'name' => $p->name,
            'category' => $p->category,
            'size' => $p->size ?? null,
            'selling_price' => (float) $p->selling_price,
            'stock_quantity' => (int) $p->stock_quantity,
            'score' => round((float) $score, 3),
            'reason' => $reason,
        ];
    }
}