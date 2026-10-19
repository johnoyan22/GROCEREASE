<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryAvailabilityLog extends Model
{
    protected $fillable = [
        'store_id', 'store_inventory_id', 'changed_by_user_id',
        'previous_status', 'new_status',
    ];

    public function inventory(): BelongsTo
    {
        return $this->belongsTo(StoreInventory::class, 'store_inventory_id', 'store_inventory_id');
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by_user_id');
    }
}
