<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Product;

class ProductSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Product::create([
            'name' => 'Premium Jasmine Rice 5kg',
            'sku' => 'RICE-0001',
            'barcode' => '4801234567890',
            'size' => '5kg',
            'category' => 'Staples',
            'base_cost' => 250.00,
            'selling_price' => 280.00,
            'stock_quantity' => 120,
            'status' => 'In Stock',
        ]);

        Product::create([
            'name' => 'Argentina Corned Beef 175g',
            'sku' => 'CBEF-0002',
            'barcode' => '4801234567891',
            'size' => '175g',
            'category' => 'Canned Goods',
            'base_cost' => 32.00,
            'selling_price' => 38.00,
            'stock_quantity' => 18,
            'status' => 'Low Stock',
        ]);

        Product::create([
            'name' => 'Absolute Distilled Water 1.5L',
            'sku' => 'WTR-0003',
            'barcode' => '4801234567892',
            'size' => '1.5L',
            'category' => 'Beverages',
            'base_cost' => 25.00,
            'selling_price' => 30.00,
            'stock_quantity' => 200,
            'status' => 'In Stock',
        ]);
    }
}