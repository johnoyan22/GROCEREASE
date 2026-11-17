<?php

namespace Tests\Support;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Support\Facades\Schema;

// Explicit fixture adaptation; production APIs never translate free text into categories.
class CategoryFixture
{
    public static function id(int $storeId, string $name): int
    {
        $name = Category::cleanName($name);
        return Category::firstOrCreate(['store_id' => $storeId, 'name_key' => Category::nameKey($name)], ['name' => $name, 'status' => 'active'])->id;
    }

    public static function product(array $data): Product
    {
        if (Schema::hasColumn('products', 'category_id') && !empty($data['store_id']) && !empty($data['category']) && !isset($data['category_id'])) {
            $data['category_id'] = self::id($data['store_id'], $data['category']);
        }
        return Product::create($data);
    }
}
