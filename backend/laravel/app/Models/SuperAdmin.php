<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class SuperAdmin extends Authenticatable
{
    use HasApiTokens;

    protected $table = 'super_admins';

    protected $primaryKey = 'admin_id';

    protected $fillable = [
        'profile_id',
        'password_hash',
        'role_type',
    ];

    protected $hidden = [
        'password_hash',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'profile_id', 'profile_id');
    }
}
