<?php

namespace App\Services;

use App\Models\StoreInventory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class BatchStock
{
    public function blocked(StoreInventory $inventory, bool $current = false): int
    {
        if (! Schema::hasTable('stock_batches')) return 0;
        $query = $this->blockedQuery()->where('store_inventory_id', $inventory->store_inventory_id)
            ->where('store_id', $inventory->store_id);
        // Writers already hold store/inventory locks. A locking read avoids an
        // older MariaDB snapshot after waiting for another stock transaction.
        if ($current) $query->lockForUpdate();
        return (int) $query->pluck('remaining_qty')->sum();
    }

    // Same formula as availableStock(), applied in SQL before public pagination.
    public function sellable(Builder $query): Builder
    {
        if (! Schema::hasTable('stock_batches')) return $query->whereRaw('store_inventory.hard_stock_qty > store_inventory.soft_stock_qty');
        $blocked = $this->blockedQuery()->whereColumn('stock_batches.store_inventory_id', 'store_inventory.store_inventory_id')
            ->whereColumn('stock_batches.store_id', 'store_inventory.store_id')->selectRaw('COALESCE(SUM(remaining_qty), 0)');
        return $query->whereRaw('store_inventory.hard_stock_qty - store_inventory.soft_stock_qty > ('.$blocked->toSql().')', $blocked->getBindings());
    }

    private function blockedQuery(): \Illuminate\Database\Query\Builder
    {
        return DB::table('stock_batches')->where(function ($query) {
            $query->where('status', 'quarantined')->orWhere('expiration_date', '<', now('Asia/Manila')->toDateString());
        });
    }

    // Called under the existing store/inventory locks immediately before physical handover.
    // Reservations stay aggregate integer soft stock; FEFO consumes safe batches, then legacy units.
    public function consume(StoreInventory $inventory, int $quantity, int $orderId, int $actor): void
    {
        if (! Schema::hasTable('stock_batches')) return;
        abort_if($inventory->hard_stock_qty - $this->blocked($inventory, true) < $inventory->soft_stock_qty, 409,
            'Expired or quarantined stock affects reservations. Supervisor reconciliation is required before handover.');
        $batches = DB::table('stock_batches')->where('store_id', $inventory->store_id)->where('store_inventory_id', $inventory->store_inventory_id)
            ->where('remaining_qty', '>', 0)->where('status', 'available')
            ->where(fn ($q) => $q->whereNull('expiration_date')->orWhere('expiration_date', '>=', now('Asia/Manila')->toDateString()))
            ->orderByRaw('expiration_date IS NULL')->orderBy('expiration_date')->orderBy('id')->lockForUpdate()->get();
        foreach ($batches as $batch) {
            $take = min($quantity, $batch->remaining_qty);
            if ($take <= 0) break;
            DB::table('stock_batches')->where('id', $batch->id)->update(['remaining_qty' => $batch->remaining_qty - $take, 'updated_at' => now()]);
            DB::table('stock_batch_events')->insert(['batch_id' => $batch->id, 'actor_user_id' => $actor, 'order_id' => $orderId,
                'event' => 'handover', 'quantity' => $take, 'description' => 'Verified physical handover; FEFO batch deduction.', 'created_at' => now()]);
            $quantity -= $take;
        }
        // Any balance uses existing unbatched stock. No legacy receipt/expiry dates are fabricated.
    }
}
