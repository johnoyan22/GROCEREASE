<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\Store;
use App\Models\StoreInventory;
use Illuminate\Database\Seeder;
use RuntimeException;

class LocalStoreInventorySeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local')) {
            throw new RuntimeException(
                'LocalStoreInventorySeeder may only run when APP_ENV=local.'
            );
        }

        $this->call([
            LocalStoreSeeder::class,
            LocalProductSeeder::class,
        ]);

        $first = Store::where('store_name', 'GrocerEase Demo Store A')
            ->where('address', 'Demo Location A, Cebu City')
            ->firstOrFail();
        $second = Store::where('store_name', 'GrocerEase Demo Store B')
            ->where('address', 'Demo Location B, Cebu City')
            ->firstOrFail();

        $riceA = Product::forStore($first->store_id)->where('sku', 'GE-DEMO-RICE-1KG')->firstOrFail();
        $riceB = Product::forStore($second->store_id)->where('sku', 'GE-DEMO-RICE-1KG')->firstOrFail();
        $water = Product::forStore($first->store_id)->where('sku', 'GE-DEMO-WATER-1L')->firstOrFail();

        $offerings = [
            [$first->store_id, $riceA->product_id, '65.00'],
            [$second->store_id, $riceB->product_id, '70.00'],
            [$first->store_id, $water->product_id, '25.00'],
        ];

        foreach ($offerings as [$storeId, $productId, $price]) {
            StoreInventory::firstOrCreate(
                ['store_id' => $storeId, 'product_id' => $productId],
                [
                    'selling_price' => $price,
                    'hard_stock_qty' => 0,
                    'soft_stock_qty' => 0,
                    'status' => StoreInventory::STATUS_INACTIVE,
                ]
            );
        }
    }
}
