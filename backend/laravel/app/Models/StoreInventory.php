<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StoreInventory extends Model
{
    protected $table = 'store_inventory';

    protected $primaryKey = 'store_inventory_id';

    protected $fillable = [
        'store_id',
        'product_id',
        'selling_price',
        'soft_stock_qty',
        'hard_stock_qty',
    ];

    protected function casts(): array
    {
        return [
            'selling_price' => 'decimal:2',
            'soft_stock_qty' => 'integer',
            'hard_stock_qty' => 'integer',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(
            Product::class,
            'product_id',
            'product_id'
        );
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(
            Store::class,
            'store_id',
            'store_id'
        );
    }
}
