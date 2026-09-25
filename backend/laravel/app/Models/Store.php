<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Store extends Model
{
    protected $primaryKey = 'store_id';

    protected $fillable = [
        'admin_id',
        'owner_id',
        'store_name',
        'address',
    ];

    public function assignedInventoryWorkers(): HasMany
    {
        return $this->hasMany(
            AssignedInventoryWorker::class,
            'store_id',
            'store_id'
        );
    }
}