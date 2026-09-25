<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\Store;
use App\Models\StoreInventory;
use Illuminate\Database\Seeder;

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $store = Store::query()
            ->where('store_name', 'GrocerEase Main Store')
            ->firstOrFail();

        $product = Product::query()->firstOrCreate(
            [
                'product_name' => 'Premium Jasmine Rice',
            ],
            [
                'category' => 'Staples',
                'base_cost' => 250.00,
            ]
        );

        StoreInventory::query()->updateOrCreate(
            [
                'store_id' => $store->store_id,
                'product_id' => $product->product_id,
            ],
            [
                'selling_price' => 285.00,
                'soft_stock_qty' => 5,
                'hard_stock_qty' => 120,
            ]
        );
    }
}
