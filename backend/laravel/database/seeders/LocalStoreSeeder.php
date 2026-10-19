<?php

namespace Database\Seeders;

use App\Models\Store;
use Illuminate\Database\Seeder;
use RuntimeException;

class LocalStoreSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local')) {
            throw new RuntimeException(
                'LocalStoreSeeder may only run when APP_ENV=local.'
            );
        }

        $stores = [
            [
                'store_name' => 'GrocerEase Demo Store A',
                'address' => 'Demo Location A, Cebu City',
            ],
            [
                'store_name' => 'GrocerEase Demo Store B',
                'address' => 'Demo Location B, Cebu City',
            ],
        ];

        foreach ($stores as $store) {
            Store::firstOrCreate($store, [
                'status' => Store::STATUS_ACTIVE,
            ]);
        }
    }
}