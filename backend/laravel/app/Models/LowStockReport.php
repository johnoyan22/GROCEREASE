<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LowStockReport extends Model
{
    protected $fillable = [
        'store_id', 'store_inventory_id', 'reported_by_user_id', 'note',
        'observed_hard_stock_qty', 'observed_soft_stock_qty',
    ];

    protected function casts(): array
    {
        return [
            'observed_hard_stock_qty' => 'integer',
            'observed_soft_stock_qty' => 'integer',
        ];
    }

    public function inventory(): BelongsTo
    {
        return $this->belongsTo(StoreInventory::class, 'store_inventory_id', 'store_inventory_id');
    }

    public function reportedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_by_user_id');
    }
}
