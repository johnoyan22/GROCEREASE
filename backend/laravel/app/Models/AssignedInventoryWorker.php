<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class AssignedInventoryWorker extends Authenticatable
{
    use HasApiTokens;

    protected $table = 'assigned_inventory_workers';

    protected $primaryKey = 'inventory_worker_id';

    protected $fillable = [
        'profile_id',
        'store_id',
        'password_hash',
        'status',
    ];

    protected $hidden = [
        'password_hash',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(
            Profile::class,
            'profile_id',
            'profile_id'
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
