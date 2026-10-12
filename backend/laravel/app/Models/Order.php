<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Order extends Model {
    use HasFactory;

    protected $fillable = [
        'subtotal',
        'service_charge',
        'total',
        'payment_method',
        'status'
    ];

    public function items() {
        return $this->hasMany(OrderItem::class);
    }
}