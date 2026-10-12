<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\SuperAdmin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SupervisorProductCatalogController extends Controller
{
    private function authorizeSupervisor(Request $request): void
    {
        $user = $request->user();

        abort_unless(
            $user instanceof SuperAdmin && $user->role_type === 'Supervisor',
            403,
            'Supervisor access required.'
        );
    }

    /** Browse and search/filter products. */
    public function index(Request $request): JsonResponse
    {
        $this->authorizeSupervisor($request);

        $filters = $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'category' => ['sometimes', 'nullable', 'string', 'max:50'],
            'store_id' => [
                'sometimes',
                'nullable',
                'integer',
                'min:1',
                'exists:stores,store_id'
            ],
            'availability' => [
                'sometimes',
                Rule::in(['Available', 'Unavailable'])
            ],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);

        $query = Product::query()->with([
            'storeInventories' => function ($query) use ($filters) {
                if (isset($filters['store_id'])) {
                    $query->where('store_id', $filters['store_id']);
                }

                $query->orderBy('store_id');
            }
        ]);

        // Module 1 and 2: Browse and Search Products
        if (filled($filters['search'] ?? null)) {
            $term = $filters['search'];

            $query->where(function ($q) use ($term) {
                $q->where('product_name', 'like', '%' . $term . '%')
                    ->orWhere('category', 'like', '%' . $term . '%');
            });
        }

        // Filter by category
        if (filled($filters['category'] ?? null)) {
            $query->where('category', $filters['category']);
        }

        // Filter by store
        if (isset($filters['store_id'])) {
            $query->whereHas(
                'storeInventories',
                fn ($q) => $q->where('store_id', $filters['store_id'])
            );
        }

        // Filter by availability
        if (isset($filters['availability'])) {
            $query->whereHas('storeInventories', function ($q) use ($filters) {
                if (isset($filters['store_id'])) {
                    $q->where('store_id', $filters['store_id']);
                }

                $filters['availability'] === 'Available'
                    ? $q->where('hard_stock_qty', '>', 0)
                    : $q->where('hard_stock_qty', '<=', 0);
            });
        }

        $products = $query
            ->orderBy('product_name')
            ->paginate($filters['per_page'] ?? 15);

        return response()->json([
            'data' => collect($products->items())
                ->map(fn (Product $p) => $this->formatProduct($p))
                ->values(),

            'meta' => [
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
                'per_page' => $products->perPage(),
                'total' => $products->total(),
            ],
        ]);
    }

    /** Module 3: View Product Details. */
    public function show(Request $request, Product $product): JsonResponse
    {
        $this->authorizeSupervisor($request);

        $product->load([
            'storeInventories' => fn ($query) =>
                $query->orderBy('store_id')
        ]);

        return response()->json([
            'data' => $this->formatProduct($product)
        ]);
    }

    private function formatProduct(Product $product): array
    {
        return [
            'product_id' => $product->product_id,
            'product_name' => $product->product_name,
            'category' => $product->category,
            'base_cost' => (float) $product->base_cost,

            'store_inventory' => $product->storeInventories
                ->map(fn ($item) => [
                    'store_inventory_id' => $item->store_inventory_id,
                    'store_id' => $item->store_id,
                    'selling_price' => (float) $item->selling_price,
                    'hard_stock_qty' => (int) $item->hard_stock_qty,
                    'soft_stock_qty' => (int) $item->soft_stock_qty,
                    'availability' => $item->hard_stock_qty > 0
                        ? 'Available'
                        : 'Unavailable',
                ])->values(),

            'created_at' => $product->created_at?->toIso8601String(),
            'updated_at' => $product->updated_at?->toIso8601String(),
        ];
    }
}
