<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    protected $primaryKey = 'order_id';

    protected $fillable = [
        'store_id', 'shopper_user_id', 'store_name', 'store_address', 'shopper_name',
        'status', 'payment_method', 'payment_status', 'reservation_status', 'subtotal_centavos',
        'service_fee_centavos', 'total_centavos', 'service_fee_policy', 'currency',
        'idempotency_key', 'request_hash', 'canceled_at', 'completed_at',
        'pickup_window_start_at', 'pickup_window_end_at', 'scheduled_store_closes_at',
    ];

    protected function casts(): array
    {
        return [
            'subtotal_centavos' => 'integer', 'service_fee_centavos' => 'integer', 'total_centavos' => 'integer',
            'canceled_at' => 'datetime', 'completed_at' => 'datetime',
            'pickup_window_start_at' => 'datetime', 'pickup_window_end_at' => 'datetime', 'scheduled_store_closes_at' => 'datetime',
            'ready_at' => 'datetime', 'claim_expires_at' => 'datetime', 'unclaimed_at' => 'datetime',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class, 'order_id', 'order_id');
    }

    public function history(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class, 'order_id', 'order_id')->orderBy('id');
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class, 'store_id', 'store_id');
    }
}
