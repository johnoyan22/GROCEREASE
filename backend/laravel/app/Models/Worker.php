<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class Worker extends Authenticatable
{
    use HasApiTokens;

    protected $primaryKey = 'worker_id';

    protected $fillable = [
        'profile_id',
        'password_hash',
        'worker_incentives',
        'order_handled',
    ];

    protected $hidden = [
        'password_hash',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'profile_id', 'profile_id');
    }
}
