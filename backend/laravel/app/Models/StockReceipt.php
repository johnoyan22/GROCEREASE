<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockReceipt extends Model
{
    use \App\Models\Concerns\HasReceiptDates;
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['quantity' => 'integer', 'received_date' => 'date:Y-m-d', 'expiry_date' => 'date:Y-m-d', 'decided_at' => 'datetime'];
    }
}
