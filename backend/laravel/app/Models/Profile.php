<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Profile extends Model
{
    protected $primaryKey = 'profile_id';

    protected $fillable = [
        'first_name',
        'last_name',
        'phone_number',
        'address',
        'imagesrc',
    ];

    protected function casts(): array
    {
        return [
            'phone_verified_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }
}
