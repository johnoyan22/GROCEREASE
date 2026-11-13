<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CatalogInventory;
use App\Services\PublicStoreAccess;
use Illuminate\Http\Request;

class PublicCatalogController extends Controller
{
    public function index(Request $request, int $store, PublicStoreAccess $access, CatalogInventory $catalog)
    {
        $selected = $access->find($store);
        $input = $request->validate([
            'search' => ['nullable', 'string', 'max:100'], 'category' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1', 'max:100000'], 'per_page' => ['nullable', 'integer', 'min:1', 'max:24'],
        ]);
        $query = $catalog->sellable($selected)->join('products as catalog_products', function ($join) {
            $join->on('catalog_products.product_id', '=', 'store_inventory.product_id')->on('catalog_products.store_id', '=', 'store_inventory.store_id');
        });
        $categories = (clone $query)->reorder()->select('catalog_products.category')->distinct()->orderBy('catalog_products.category')->pluck('catalog_products.category')->filter()->values();
        $search = trim($input['search'] ?? '');
        if ($search !== '') {
            // Bound literal LIKE: % and _ entered by visitors are not wildcard operators.
            $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($search)).'%';
            $query->where(function ($query) use ($pattern) {
                foreach (['product_name', 'category', 'size'] as $column) $query->orWhereRaw('LOWER(catalog_products.'.$column.") LIKE ? ESCAPE '!'", [$pattern]);
            });
        }
        if (! empty($input['category'])) $query->where('catalog_products.category', $input['category']);
        $page = $query->select('store_inventory.*')->orderBy('catalog_products.product_name')->orderBy('store_inventory.store_inventory_id')
            ->paginate($input['per_page'] ?? 12);
        $products = $page->getCollection()->map(fn ($item) => [
            'product_id' => $item->product_id, 'store_id' => $selected->store_id,
            'product_name' => $item->product->product_name, 'category' => $item->product->category,
            'size' => $item->product->size, 'selling_unit' => $item->product->selling_unit,
            'selling_price' => $item->selling_price, 'availability' => 'available',
            'image_url' => $item->product->image_path ? url('/api/public/stores/'.$selected->store_id.'/products/'.$item->product_id.'/photo') : null,
        ]);
        return response()->json(['store' => $selected->only(['store_id', 'store_name', 'address']), 'products' => $products,
            'categories' => $categories, 'pagination' => ['page' => $page->currentPage(), 'per_page' => $page->perPage(),
                'total' => $page->total(), 'last_page' => $page->lastPage()],
            'notice' => 'Current availability only. Login to shop; Checkout revalidates price and stock.'], 200, ['Cache-Control' => 'no-store']);
    }
}
