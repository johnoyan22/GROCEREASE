<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Store;
use App\Models\StoreInventory;
use Illuminate\Http\JsonResponse;

class ShopperCatalogController extends Controller
{
    public function stores(): JsonResponse
    {
        return response()->json([
            'stores' => Store::active()->orderBy('store_name')->orderBy('store_id')
                ->get(['store_id', 'store_name', 'address']),
        ]);
    }

    public function products(int $store): JsonResponse
    {
        $selectedStore = Store::active()->findOrFail($store);
        $inventory = StoreInventory::forStore($selectedStore->store_id)
            ->where('status', StoreInventory::STATUS_ACTIVE)
            ->whereHas('product', function ($query) use ($selectedStore) {
                $query->forStore($selectedStore->store_id);
            })->with('product')->orderBy('store_inventory_id')->get();
        $products = [];
        foreach ($inventory as $item) {
            $products[] = [
                'store_inventory_id' => $item->store_inventory_id,
                'product_id' => $item->product_id,
                'store_id' => $item->store_id,
                'product_name' => $item->product->product_name,
                'sku' => $item->product->sku,
                'barcode' => $item->product->barcode,
                'category' => $item->product->category,
                'size' => $item->product->size,
                'selling_price' => $item->selling_price,
                'available_stock' => $item->availableStock(),
                'max_per_order' => $item->max_per_order,
                'is_low_stock' => $item->isLowStock(),
            ];
        }
        return response()->json([
            'store' => $selectedStore->only(['store_id', 'store_name', 'address']),
            'products' => $products,
        ]);
    }
}
