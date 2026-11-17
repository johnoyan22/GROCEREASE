<?php

namespace App\Services;

use App\Models\Store;
use App\Models\StoreInventory;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class LowStockMonitor
{
    public static function isLow(StoreInventory $item, ?Store $store = null): bool
    {
        return $item->status === 'active' && ($store ?? $item->store)?->status === 'active'
            && $item->low_stock_threshold !== null && $item->hard_stock_qty <= $item->low_stock_threshold;
    }

    public static function lowQuery($query)
    {
        return $query->where('status', 'active')->whereHas('store', fn ($q) => $q->active())
            ->whereNotNull('low_stock_threshold')->whereColumn('hard_stock_qty', '<=', 'low_stock_threshold');
    }

    // Call inside the business transaction after store -> inventory locks and stock/policy save.
    // Alert evidence and the durable delivery intent commit or roll back with the business result.
    public function evaluate(StoreInventory $item, Store $store, string $source): void
    {
        abort_unless(DB::transactionLevel() > 0, 500, 'Low-stock evaluation requires a transaction.');
        $this->requireSchema();
        $episode = DB::table('low_stock_episodes')->where('active_inventory_id', $item->store_inventory_id)->lockForUpdate()->first();
        $current = ['current_physical_qty' => $item->hard_stock_qty, 'current_reorder_level' => $item->low_stock_threshold, 'evaluated_at' => now()];
        if (!self::isLow($item, $store)) {
            if ($episode) DB::table('low_stock_episodes')->where('id', $episode->id)->update([...$current,
                'active_inventory_id' => null, 'closed_at' => now(), 'closure_reason' => $store->status !== 'active' ? 'store_inactive'
                    : ($item->status !== 'active' ? 'offering_inactive' : ($item->low_stock_threshold === null ? 'threshold_cleared' : 'recovered'))]);
            return;
        }
        if (!$episode) {
            $product = \App\Models\Product::forStore($store->store_id)->whereKey($item->product_id)->lockForUpdate()->firstOrFail();
            $id = DB::table('low_stock_episodes')->insertGetId([...$current, 'store_id' => $store->store_id,
                'store_inventory_id' => $item->store_inventory_id, 'active_inventory_id' => $item->store_inventory_id,
                'product_name' => $product->product_name, 'sku' => $product->sku, 'selling_unit' => $product->selling_unit,
                'observed_physical_qty' => $item->hard_stock_qty, 'reorder_level' => $item->low_stock_threshold,
                'stock_version' => $item->stock_version, 'started_at' => now(), 'opened_from' => $source]);
        } else {
            $id = $episode->id;
            DB::table('low_stock_episodes')->where('id', $id)->update($current);
        }
        // Durable outbox: delivery starts after commit, using user -> assignment ->
        // store locks, never locking other users while a stock writer holds the store.
        DB::afterCommit(fn () => $this->deliverEpisode((int) $id));
    }

    public function deliverEpisode(int $id): bool
    {
        try {
            $episode = DB::table('low_stock_episodes')->where('id', $id)->firstOrFail();
            $recipients = User::where('account_status', 'active')->whereNotNull('staff_approved_at')->whereNotNull('staff_approved_by_user_id')
                ->whereHas('role', fn ($q) => $q->whereIn('slug', User::STAFF_ROLES))
                ->whereHas('staffStoreAssignment', fn ($q) => $q->where('store_id', $episode->store_id))->orderBy('id')->pluck('id');
            foreach ($recipients as $userId) DB::transaction(function () use ($episode, $userId) {
                $user = User::with('role')->whereKey($userId)->lockForUpdate()->first();
                if (!$user || $user->account_status !== 'active' || !$user->isApprovedStaff()) return;
                $placement = $user->staffStoreAssignment()->lockForUpdate()->first();
                if (!$placement || (int) $placement->store_id !== (int) $episode->store_id) return;
                $store = Store::whereKey($episode->store_id)->lockForUpdate()->first();
                if (!$store || $store->status !== 'active') return;
                if (DB::table('staff_low_stock_notifications')->where('episode_id', $episode->id)->where('user_id', $user->id)->lockForUpdate()->first()) return;
                DB::table('staff_low_stock_notifications')->insert(['episode_id' => $episode->id, 'store_id' => $episode->store_id,
                    'user_id' => $user->id, 'delivered_at' => now()]);
            }, 5);
            DB::table('low_stock_episodes')->where('id', $id)->update(['delivery_pending' => false]);
            return true;
        } catch (\Throwable $error) {
            // Keep the committed business result successful and retain a durable retry.
            try { DB::table('low_stock_episodes')->where('id', $id)->update(['delivery_pending' => true]); }
            catch (\Throwable $retryError) { report($retryError); }
            report($error);
            return false;
        }
    }

    public function evaluateStore(Store $store, string $source): void
    {
        StoreInventory::forStore($store->store_id)->where(fn ($q) => $q->whereNotNull('low_stock_threshold')
            ->orWhereIn('store_inventory_id', DB::table('low_stock_episodes')->whereNotNull('active_inventory_id')->select('active_inventory_id')))
            ->orderBy('store_inventory_id')->lockForUpdate()->chunkById(100, function ($items) use ($store, $source) {
                foreach ($items as $item) $this->evaluate($item, $store, $source);
            }, 'store_inventory_id');
    }

    public function reconcile(): int
    {
        $this->requireSchema();
        $count = 0;
        StoreInventory::where(fn ($q) => $q->whereNotNull('low_stock_threshold')
            ->orWhereIn('store_inventory_id', DB::table('low_stock_episodes')->whereNotNull('active_inventory_id')->select('active_inventory_id')))
            ->select(['store_inventory_id', 'store_id'])->chunkById(100, function ($items) use (&$count) {
                foreach ($items as $reference) DB::transaction(function () use ($reference, &$count) {
                    $store = Store::whereKey($reference->store_id)->lockForUpdate()->firstOrFail();
                    $item = StoreInventory::whereKey($reference->store_inventory_id)->lockForUpdate()->firstOrFail();
                    $this->evaluate($item, $store, 'reconciliation');
                    $count++;
                }, 5);
            }, 'store_inventory_id');
        DB::table('low_stock_episodes')->where('delivery_pending', true)->orderBy('id')->chunkById(100, function ($episodes) {
            foreach ($episodes as $episode) $this->deliverEpisode((int) $episode->id);
        });
        if (DB::table('low_stock_episodes')->where('delivery_pending', true)->exists()) throw new \RuntimeException('Some low-stock notifications await delivery; retry reconciliation.');
        return $count;
    }

    public function requireSchema(): void
    {
        abort_unless(Schema::hasTable('low_stock_episodes') && Schema::hasTable('staff_low_stock_notifications'),
            503, 'Automatic low-stock monitoring is awaiting database setup.');
    }
}
