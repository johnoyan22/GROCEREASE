<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Store extends Model
{
    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';

    protected $primaryKey = 'store_id';

    protected $fillable = [
        'store_name',
        'address',
        'status',
    ];

    protected $attributes = [
        'status' => self::STATUS_ACTIVE,
    ];

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    public function storeInventories(): HasMany
    {
        return $this->hasMany(StoreInventory::class, 'store_id', 'store_id');
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class, 'store_id', 'store_id');
    }

        public function staffStoreAssignments(): HasMany
    {
        return $this->hasMany(StaffStoreAssignment::class, 'store_id', 'store_id');
    }
}
