<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    protected $primaryKey = 'product_id';

    protected $fillable = [
        'store_id',
        'product_name',
        'sku',
        'barcode',
        'size',
        'category',
        'size_amount', 'size_unit', 'selling_unit',
    ];

    protected static function booted(): void
    {
        static::creating(function (Product $product) {
            if (!$product->sku) {
                do {
                    $sequence = \Illuminate\Support\Facades\DB::table('product_sku_sequences')->insertGetId([]);
                    $sku = sprintf('GE-S%03d-P%06d', $product->store_id, $sequence);
                } while (static::where('store_id', $product->store_id)->where('sku', $sku)->exists());
                $product->sku = $sku;
            }
        });
        static::updating(function (Product $product) {
            if ($product->isDirty('sku')) throw new \LogicException('Product SKU is immutable.');
        });
    }

    protected function sku(): Attribute
    {
        return Attribute::make(
            set: fn (string $value): string => strtoupper(trim($value)),
        );
    }

    public function storeInventories(): HasMany
    {
        return $this->hasMany(StoreInventory::class, 'product_id', 'product_id');
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class, 'store_id', 'store_id');
    }

    public function scopeForStore(Builder $query, int $storeId): Builder
    {
        return $query->where($query->getModel()->qualifyColumn('store_id'), $storeId);
    }
}
