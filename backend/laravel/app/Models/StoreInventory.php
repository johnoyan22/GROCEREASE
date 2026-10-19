<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StoreInventory extends Model
{
    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';

    protected $table = 'store_inventory';
    protected $primaryKey = 'store_inventory_id';

    protected $fillable = [
        'store_id',
        'product_id',
        'selling_price',
        'hard_stock_qty',
        'soft_stock_qty',
        'status',
    ];

    protected $attributes = [
        'hard_stock_qty' => 0,
        'soft_stock_qty' => 0,
        'status' => self::STATUS_INACTIVE,
    ];

    protected function casts(): array
    {
        return [
            'selling_price' => 'decimal:2',
            'hard_stock_qty' => 'integer',
            'soft_stock_qty' => 'integer',
        ];
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class, 'store_id', 'store_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id', 'product_id');
    }

    public function scopeForStore(Builder $query, int $storeId): Builder
    {
        return $query->where(
            $query->getModel()->qualifyColumn('store_id'),
            $storeId
        );
    }
}
