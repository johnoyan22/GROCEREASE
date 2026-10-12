<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    protected $table = 'products';
    protected $primaryKey = 'product_id';

    protected $fillable = [
        'name',
        'sku',
        'barcode',
        'size',
        'category',
        'base_cost',
        'selling_price',
        'stock_quantity',
        'status',
    ];
}
