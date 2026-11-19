<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentCheckoutAttempt extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $guarded = [];
    protected $hidden = ['credential_fingerprint', 'checkout_url', 'verified_evidence'];
    protected function casts(): array
    {
        return ['verified_at' => 'datetime', 'verified_evidence' => 'array', 'observed_request_ids' => 'array', 'channels' => 'array', 'checkout_url' => 'encrypted', 'amount_centavos' => 'integer', 'store_id' => 'integer', 'order_id' => 'integer',
            'expires_at' => 'datetime', 'expired_at' => 'datetime'];
    }
}
