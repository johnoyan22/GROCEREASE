<?php

namespace App\Services;

use App\Models\InventoryBatch;
use App\Models\OrderItem;
use App\Models\StoreInventory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BatchStock
{
    // All writers must hold the store and inventory locks in the surrounding transaction.
    public function initialize(StoreInventory $inventory): void
    {
        if ($inventory->batches_initialized) return;
        if ($inventory->hard_stock_qty > 0) {
            $batch = $this->create($inventory, $inventory->hard_stock_qty, [
                'source' => 'historical', 'description' => 'Historical stock; receipt and expiry dates unknown.',
            ]);
            $lines = DB::table('order_items')->join('orders', 'orders.order_id', '=', 'order_items.order_id')
                ->where('order_items.store_inventory_id', $inventory->store_inventory_id)->where('orders.reservation_status', 'active')
                ->select('order_items.*')->get();
            foreach ($lines as $line) $this->allocation($line->order_item_id, $batch->id, $line->quantity);
        }
        $inventory->batches_initialized = true;
        $inventory->save();
    }

    public function create(StoreInventory $inventory, int $quantity, array $attributes = []): InventoryBatch
    {
        return InventoryBatch::create([
            'store_inventory_id' => $inventory->store_inventory_id,
            'reference' => 'GE-B-'.Str::ulid(), 'quantity_received' => $quantity,
            'remaining_quantity' => $quantity, ...$attributes,
        ]);
    }

    public function reserve(StoreInventory $inventory, OrderItem $item): void
    {
        $this->initialize($inventory);
        $needed = $item->quantity;
        foreach ($this->ordered($inventory)->lockForUpdate()->get() as $batch) {
            if (!$batch->eligible()) continue;
            $quantity = min($needed, $batch->remaining_quantity - $this->reserved($batch->id));
            if ($quantity <= 0) continue;
            $this->allocation($item->order_item_id, $batch->id, $quantity);
            $needed -= $quantity;
            if ($needed === 0) break;
        }
        abort_if($needed > 0, 409, 'Eligible batches changed. Refresh stock before checkout.');
    }

    public function validateItem(StoreInventory $inventory, OrderItem $item): void
    {
        $this->initialize($inventory);
        $allocations = DB::table('order_batch_allocations')->where('order_item_id', $item->order_item_id)
            ->where('status', 'reserved')->orderBy('inventory_batch_id')->lockForUpdate()->get();
        abort_unless((int) $allocations->sum('quantity') === $item->quantity, 409, 'Batch reservations require reconciliation.');
        foreach ($allocations as $allocation) {
            $batch = InventoryBatch::where('store_inventory_id', $inventory->store_inventory_id)->whereKey($allocation->inventory_batch_id)->lockForUpdate()->firstOrFail();
            abort_unless($inventory->status === 'active' && $batch->eligible() && $batch->remaining_quantity >= $this->reserved($batch->id),
                409, 'An allocated batch is expired, on hold, inactive, or short. Do not pick or release it; contact your Supervisor.');
        }
    }

    public function handover(StoreInventory $inventory, OrderItem $item): void
    {
        $this->validateItem($inventory, $item);
        foreach (DB::table('order_batch_allocations')->where('order_item_id', $item->order_item_id)->where('status', 'reserved')->lockForUpdate()->get() as $allocation) {
            $batch = InventoryBatch::whereKey($allocation->inventory_batch_id)->lockForUpdate()->firstOrFail();
            $batch->remaining_quantity -= $allocation->quantity;
            $batch->save();
        }
        DB::table('order_batch_allocations')->where('order_item_id', $item->order_item_id)->where('status', 'reserved')->update(['status' => 'fulfilled', 'updated_at' => now()]);
    }

    public function release(StoreInventory $inventory, OrderItem $item): void
    {
        $this->initialize($inventory);
        DB::table('order_batch_allocations')->where('order_item_id', $item->order_item_id)->where('status', 'reserved')->update(['status' => 'released', 'updated_at' => now()]);
    }

    public function correctBatch(StoreInventory $inventory, InventoryBatch $batch, int $actual, int $adjustmentId): void
    {
        // Caller holds store -> inventory -> selected batch -> request -> allocation locks.
        abort_unless($batch->store_inventory_id === $inventory->store_inventory_id, 409, 'Batch ownership changed.');
        $allocated = DB::table('order_batch_allocations')->where('inventory_batch_id', $batch->id)
            ->where('status', 'reserved')->orderBy('id')->lockForUpdate()->get();
        $delta = $actual - $batch->remaining_quantity;
        $total = $inventory->hard_stock_qty + $delta;
        abort_if($actual < (int) $allocated->sum('quantity') || $total < $inventory->soft_stock_qty,
            409, 'Reconciliation required: the count conflicts with reserved stock. Reservations and orders were not changed.');
        abort_if($total < 0 || $total > 2147483647, 409, 'The corrected product total is outside the supported range.');
        abort_unless((int) $inventory->batches()->sum('remaining_quantity') === $inventory->hard_stock_qty,
            409, 'Reconciliation required: batch and product physical totals disagree.');
        $batch->remaining_quantity = $actual;
        $batch->save();
        $this->correctionLog($adjustmentId, $batch->id, $delta);
        $inventory->hard_stock_qty = $total;
        $inventory->stock_version++;
        $inventory->save();
    }

    public function pickingData(OrderItem $item): array
    {
        return DB::table('order_batch_allocations')->join('inventory_batches', 'inventory_batches.id', '=', 'order_batch_allocations.inventory_batch_id')
            ->where('order_item_id', $item->order_item_id)->orderByRaw('expiry_date IS NULL')->orderBy('expiry_date')->orderBy('inventory_batches.id')
            ->get(['inventory_batches.id as batch_id', 'reference', 'quantity', 'received_date', 'expiry_date', 'inventory_batches.status', 'order_batch_allocations.status as allocation_status'])
            ->map(function ($row) {
                $row->batch_no = InventoryBatch::displayNumber((int) $row->batch_id, $row->reference);
                $row->eligible = $row->status === 'active' && (!$row->expiry_date || $row->expiry_date >= now('Asia/Manila')->format('Y-m-d'));
                return (array) $row;
            })->all();
    }

    private function ordered(StoreInventory $inventory)
    {
        // Known earliest expiry first; explicitly unknown dates follow known dates.
        return InventoryBatch::where('store_inventory_id', $inventory->store_inventory_id)->where('remaining_quantity', '>', 0)
            ->orderByRaw('expiry_date IS NULL')->orderBy('expiry_date')->orderBy('id');
    }

    private function reserved(int $batchId): int
    {
        return (int) DB::table('order_batch_allocations')->where('inventory_batch_id', $batchId)->where('status', 'reserved')->sum('quantity');
    }

    private function allocation(int $itemId, int $batchId, int $quantity): void
    {
        DB::table('order_batch_allocations')->insert(['order_item_id' => $itemId, 'inventory_batch_id' => $batchId,
            'quantity' => $quantity, 'status' => 'reserved', 'created_at' => now(), 'updated_at' => now()]);
    }

    private function correctionLog(int $adjustmentId, int $batchId, int $delta): void
    {
        DB::table('batch_correction_logs')->insert(['stock_adjustment_id' => $adjustmentId, 'inventory_batch_id' => $batchId,
            'quantity_change' => $delta, 'created_at' => now(), 'updated_at' => now()]);
    }
}
