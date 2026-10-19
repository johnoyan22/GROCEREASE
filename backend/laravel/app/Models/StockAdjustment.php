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
    ];

    protected function casts(): array
    {
        return [
            'observed_hard_stock_qty' => 'integer', 'observed_soft_stock_qty' => 'integer',
            'observed_stock_version' => 'integer', 'requested_hard_stock_qty' => 'integer',
            'decided_at' => 'datetime',
        ];
    }

    public function inventory(): BelongsTo
    {
        return $this->belongsTo(StoreInventory::class, 'store_inventory_id', 'store_inventory_id');
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
