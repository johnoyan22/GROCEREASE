<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AssignedInventoryWorker;
use App\Models\StoreInventory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $inventoryWorker = $request->user();

        if (! $inventoryWorker instanceof AssignedInventoryWorker || $inventoryWorker->status !== 'Active') {
            abort(403, 'Only active assigned inventory workers can view inventory products.');
        }

        $inventoryItems = StoreInventory::query()
            ->with('product')
            ->where('store_id', $inventoryWorker->store_id)
            ->orderBy('store_inventory_id')
            ->get();

        // TODO: This is a temporary READ contract. The Figma product design includes
        // SKU, barcode, size, and status, but those columns are not in the current schema.
        // Add the columns through a migration, then update this response and the UI together.
        $products = $inventoryItems->map(function (StoreInventory $inventory): array {
            return [
                'store_inventory_id' => $inventory->store_inventory_id,
                'product_id' => $inventory->product->product_id,
                'product_name' => $inventory->product->product_name,
                'category' => $inventory->product->category,
                'base_cost' => (float) $inventory->product->base_cost,
                'selling_price' => (float) $inventory->selling_price,
                'soft_stock_qty' => $inventory->soft_stock_qty,
                'hard_stock_qty' => $inventory->hard_stock_qty,
                'availability' => $inventory->hard_stock_qty > 0 ? 'Available' : 'Unavailable',
                'updated_at' => $inventory->updated_at?->toIso8601String(),
            ];
        })->values();

        return response()->json([
            'store' => [
                'store_id' => $inventoryWorker->store->store_id,
                'store_name' => $inventoryWorker->store->store_name,
                'address' => $inventoryWorker->store->address,
            ],
            'products' => $products,
        ]);
    }
}
