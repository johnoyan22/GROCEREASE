<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

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
            'stock_version' => 'integer',
            'max_per_order' => 'integer',
            'low_stock_threshold' => 'integer',
            'batches_initialized' => 'boolean',
        ];
    }

    public function availableStock(): int
    {
        if (!$this->batches_initialized) return max(0, $this->hard_stock_qty - $this->soft_stock_qty);
        $eligible = (int) $this->batches()->where('status', 'active')
            ->where(fn ($q) => $q->whereNull('expiry_date')->orWhere('expiry_date', '>=', now('Asia/Manila')->format('Y-m-d')))->sum('remaining_quantity');
        $allocated = (int) DB::table('order_batch_allocations')->join('inventory_batches', 'inventory_batches.id', '=', 'inventory_batch_id')
            ->where('store_inventory_id', $this->store_inventory_id)->where('order_batch_allocations.status', 'reserved')->sum('quantity');
        $eligibleReserved = (int) DB::table('order_batch_allocations')->join('inventory_batches', 'inventory_batches.id', '=', 'inventory_batch_id')
            ->where('store_inventory_id', $this->store_inventory_id)->where('order_batch_allocations.status', 'reserved')
            ->where('inventory_batches.status', 'active')->where(fn ($q) => $q->whereNull('expiry_date')->orWhere('expiry_date', '>=', now('Asia/Manila')->format('Y-m-d')))->sum('quantity');
        return max(0, min($this->hard_stock_qty - $this->soft_stock_qty, $eligible - $eligibleReserved - max(0, $this->soft_stock_qty - $allocated)));
    }

    public function batches(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(InventoryBatch::class, 'store_inventory_id', 'store_inventory_id');
    }

    public function isLowStock(): bool
    {
        return \App\Services\LowStockMonitor::isLow($this);
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
