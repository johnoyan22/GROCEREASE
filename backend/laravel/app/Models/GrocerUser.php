<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class GrocerUser extends Authenticatable
{
    use HasApiTokens;

    protected $table = 'grocer_users';

    protected $primaryKey = 'user_id';

    protected $fillable = [
        'profile_id',
        'password_hash',
        'address',
        'photo',
        'date_created',
    ];

    protected $hidden = [
        'password_hash',
    ];

    protected function casts(): array
    {
        return [
            'date_created' => 'datetime',
        ];
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'profile_id', 'profile_id');
    }
}
