<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentCheckoutAttempt extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $guarded = [];
    protected $hidden = ['credential_fingerprint', 'checkout_url'];
    protected function casts(): array
    {
        return ['channels' => 'array', 'checkout_url' => 'encrypted', 'amount_centavos' => 'integer', 'store_id' => 'integer', 'order_id' => 'integer',
            'expires_at' => 'datetime', 'expired_at' => 'datetime'];
    }
}
