<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    protected $primaryKey = 'product_id';

    protected $fillable = [
        'product_name',
        'category',
        'base_cost',
    ];

    protected function casts(): array
    {
        return [
            'base_cost' => 'decimal:2',
        ];
    }

    public function storeInventories(): HasMany
    {
        return $this->hasMany(
            StoreInventory::class,
            'product_id',
            'product_id'
        );
    }
}
