<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\Store;
use Illuminate\Database\Seeder;
use RuntimeException;

class LocalProductSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local')) {
            throw new RuntimeException(
                'LocalProductSeeder may only run when APP_ENV=local.'
            );
        }

        $this->call(LocalStoreSeeder::class);
        $first = Store::where('store_name', 'GrocerEase Demo Store A')
            ->where('address', 'Demo Location A, Cebu City')->firstOrFail();
        $second = Store::where('store_name', 'GrocerEase Demo Store B')
            ->where('address', 'Demo Location B, Cebu City')->firstOrFail();

        $products = [
            [
                'store_id' => $first->store_id,
                'sku' => 'GE-DEMO-RICE-1KG',
                'product_name' => 'Demo Jasmine Rice',
                'barcode' => null,
                'size' => '1 kg',
                'category' => 'Staples',
            ],
            [
                'store_id' => $second->store_id,
                'sku' => 'GE-DEMO-RICE-1KG',
                'product_name' => 'Demo Jasmine Rice',
                'barcode' => null,
                'size' => '1 kg',
                'category' => 'Staples',
            ],
            [
                'store_id' => $first->store_id,
                'sku' => 'GE-DEMO-WATER-1L',
                'product_name' => 'Demo Drinking Water',
                'barcode' => null,
                'size' => '1 L',
                'category' => 'Beverages',
            ],
        ];

        foreach ($products as $product) {
            Product::firstOrCreate(
                ['store_id' => $product['store_id'], 'sku' => $product['sku']],
                $product
            );
        }
    }
}
