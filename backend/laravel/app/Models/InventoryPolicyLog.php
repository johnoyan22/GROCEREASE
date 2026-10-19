<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryPolicyLog extends Model
{
    protected $fillable = [
        'store_id', 'store_inventory_id', 'changed_by_user_id', 'previous_max_per_order',
        'new_max_per_order', 'previous_low_stock_threshold', 'new_low_stock_threshold',
    ];
}
