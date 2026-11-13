<?php

namespace App\Services;

use App\Models\StoreInventory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class StockAlerts
{
    public function sync(StoreInventory $inventory): void
    {
        if (! Schema::hasTable('stock_alert_states')) return;
        DB::transaction(function () use ($inventory) {
            // Same lock order as Checkout and stock writes, including scheduler calls.
            DB::table('stores')->where('store_id', $inventory->store_id)->lockForUpdate()->first();
            $item = StoreInventory::whereKey($inventory->store_inventory_id)->lockForUpdate()->first();
            if (! $item) return;
            DB::table('stock_alert_states')->insertOrIgnore(['store_inventory_id' => $item->store_inventory_id, 'current_alert_id' => null]);
            $state = DB::table('stock_alert_states')->where('store_inventory_id', $item->store_inventory_id)->lockForUpdate()->first();
            $available = $item->availableStock(true);
            $low = $item->status === 'active' && $item->low_stock_threshold !== null && $available <= $item->low_stock_threshold;
            if ($low && ! $state->current_alert_id) {
                $id = DB::table('stock_alerts')->insertGetId(['store_id' => $item->store_id, 'store_inventory_id' => $item->store_inventory_id,
                    'product_name' => $item->product->product_name, 'available_qty' => $available,
                    'reorder_level' => $item->low_stock_threshold, 'created_at' => now()]);
                DB::table('stock_alert_states')->where('store_inventory_id', $item->store_inventory_id)->update(['current_alert_id' => $id]);
            } elseif (! $low && $state->current_alert_id) {
                DB::table('stock_alerts')->where('id', $state->current_alert_id)->update(['recovered_at' => now()]);
                DB::table('stock_alert_states')->where('store_inventory_id', $item->store_inventory_id)->update(['current_alert_id' => null]);
            }
        });
    }

    public function scan(): int
    {
        if (! Schema::hasTable('stock_alert_states')) return 0;
        $count = 0;
        StoreInventory::orderBy('store_inventory_id')->chunkById(100, function ($rows) use (&$count) {
            foreach ($rows as $row) { $this->sync($row); $count++; }
        }, 'store_inventory_id');
        return $count;
    }
}
