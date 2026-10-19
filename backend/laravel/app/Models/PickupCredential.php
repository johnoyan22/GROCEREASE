<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PickupCredential extends Model
{
    protected $guarded = ['id'];
    protected $hidden = ['token_hash', 'pin_hash', 'secret_payload'];

    protected function casts(): array
    {
        return ['secret_payload' => 'encrypted:array', 'expires_at' => 'datetime', 'consumed_at' => 'datetime', 'revoked_at' => 'datetime'];
    }
}
