<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    protected $primaryKey = 'order_item_id';
    protected $fillable = [
        'order_id', 'store_id', 'store_inventory_id', 'product_name', 'sku', 'size',
        'quantity', 'unit_price_centavos', 'line_total_centavos',
    ];

    protected function casts(): array
    {
        return ['quantity' => 'integer', 'prepared_qty' => 'integer', 'prepared_at' => 'datetime', 'unit_price_centavos' => 'integer', 'line_total_centavos' => 'integer'];
    }
}
