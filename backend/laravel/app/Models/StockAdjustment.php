<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockAdjustment extends Model
{
    protected $fillable = [
        'store_id', 'store_inventory_id', 'requested_by_user_id',
        'observed_hard_stock_qty', 'observed_soft_stock_qty', 'observed_stock_version',
        'requested_hard_stock_qty', 'reason', 'status', 'decided_by_user_id', 'decision_note', 'decided_at',
        'inventory_batch_id', 'pending_batch_id', 'operation_id', 'request_hash',
        'observed_remaining_quantity', 'requested_remaining_quantity', 'observed_allocated_quantity', 'batch_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'observed_hard_stock_qty' => 'integer', 'observed_soft_stock_qty' => 'integer',
            'observed_stock_version' => 'integer', 'requested_hard_stock_qty' => 'integer',
            'decided_at' => 'datetime',
            'inventory_batch_id' => 'integer', 'observed_remaining_quantity' => 'integer',
            'requested_remaining_quantity' => 'integer', 'observed_allocated_quantity' => 'integer', 'batch_snapshot' => 'array',
        ];
    }

    public function inventory(): BelongsTo
    {
        return $this->belongsTo(StoreInventory::class, 'store_inventory_id', 'store_inventory_id');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(InventoryBatch::class, 'inventory_batch_id');
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_user_id');
    }

    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by_user_id');
    }
}
