<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Store;
use App\Models\StoreInventory;
use App\Models\User;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class StoreInventoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return $this->withAssignedStore($request, function (Store $store) use ($request) {
            $request->validate($this->protectedFields());
            $inventory = $this->ownedInventory($store)->with('product')
                ->orderBy('store_inventory_id')->get()
                ->map(fn (StoreInventory $item): array => $this->itemData($item));

            return response()->json([
                'store' => $this->storeData($store),
                'inventory' => $inventory,
            ]);
        }, true);
    }

    public function store(Request $request): JsonResponse
    {
        try {
            return $this->withAssignedStore($request, function (Store $store) use ($request) {
                $this->normalizeSku($request);
                $validated = $request->validate(array_merge(
                    $this->writeRules(),
                    $this->productRules($store)
                ));

                $product = Product::create(array_merge(
                    ['store_id' => $store->store_id],
                    $this->metadata($validated)
                ));
                $item = StoreInventory::create([
                    'store_id' => $store->store_id,
                    'product_id' => $product->product_id,
                    'selling_price' => $validated['selling_price'],
                    'status' => $validated['status'],
                    'hard_stock_qty' => 0,
                    'soft_stock_qty' => 0,
                ]);

                return response()->json([
                    'message' => 'Product added to your store.',
                    'store' => $this->storeData($store),
                    'inventory' => $this->itemData($item->load('product')),
                ], 201);
            });
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages([
                'sku' => 'This SKU is already used by a product in your store.',
            ]);
        }
    }

    public function update(Request $request, string $item): JsonResponse
    {
        try {
            return $this->withAssignedStore($request, function (Store $store) use ($item, $request) {
                $inventory = $this->ownedInventory($store)
                    ->whereKey($item)->lockForUpdate()->firstOrFail();
                $product = Product::forStore($store->store_id)
                    ->whereKey($inventory->product_id)->lockForUpdate()->firstOrFail();

                $this->normalizeSku($request);
                $validated = $request->validate(array_merge(
                    $this->writeRules(),
                    $this->productRules($store, $product)
                ));

                $product->update($this->metadata($validated));
                $inventory->fill([
                    'selling_price' => $validated['selling_price'],
                    'status' => $validated['status'],
                ]);
                $inventory->touch();

                return response()->json([
                    'message' => 'Your store product has been saved.',
                    'store' => $this->storeData($store),
                    'inventory' => $this->itemData($inventory->load('product')),
                ]);
            });
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages([
                'sku' => 'This SKU is already used by a product in your store.',
            ]);
        }
    }

    private function ownedInventory(Store $store): Builder
    {
        return StoreInventory::forStore($store->store_id)
            ->whereHas('product', fn ($query) => $query->forStore($store->store_id));
    }

    private function withAssignedStore(Request $request, Closure $action, bool $allowSupervisor = false): JsonResponse
    {
        return DB::transaction(function () use ($request, $action, $allowSupervisor) {
            $user = User::query()->with('role')->lockForUpdate()
                ->findOrFail($request->user()->id);
            $roles = $allowSupervisor ? ['inventory_worker', 'supervisor'] : ['inventory_worker'];

            abort_unless(
                in_array($user->role?->slug, $roles, true) && $user->isApprovedStaff(),
                403,
                'An Admin-approved staff account with permission for this operation is required.'
            );

            $assignment = $user->staffStoreAssignment()->lockForUpdate()->first();
            $store = $assignment
                ? Store::query()->lockForUpdate()->find($assignment->store_id)
                : null;

            abort_unless(
                $store && $store->status === Store::STATUS_ACTIVE,
                403,
                'You need an active store assignment. Contact your Admin or Supervisor.'
            );

            return $action($store);
        }, 3);
    }

    private function protectedFields(): array
    {
        return array_fill_keys([
            'store_id', 'user_id', 'role', 'role_id', 'assigned_by_user_id',
            'store_inventory_id', 'product_id', 'hard_stock_qty', 'soft_stock_qty',
            'stock_quantity', 'base_cost', 'base_price',
        ], ['prohibited']);
    }

    private function writeRules(): array
    {
        return array_merge($this->protectedFields(), [
            'selling_price' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:99999999.99'],
            'status' => ['required', Rule::in([
                StoreInventory::STATUS_ACTIVE, StoreInventory::STATUS_INACTIVE,
            ])],
        ]);
    }

    private function productRules(Store $store, ?Product $product = null): array
    {
        $required = $product ? ['sometimes', 'required'] : ['required'];
        $sku = Rule::unique('products', 'sku')->where('store_id', $store->store_id);
        if ($product) {
            $sku->ignore($product->product_id, 'product_id');
        }

        return [
            'product_name' => [...$required, 'string', 'max:255'],
            'sku' => [...$required, 'string', 'max:64', $sku],
            'barcode' => ['sometimes', 'nullable', 'string', 'max:64'],
            'size' => ['sometimes', 'nullable', 'string', 'max:100'],
            'category' => [...$required, 'string', 'max:100'],
        ];
    }

    private function normalizeSku(Request $request): void
    {
        if (is_string($request->input('sku'))) {
            $request->merge(['sku' => strtoupper(trim($request->input('sku')))]);
        }
    }

    private function metadata(array $validated): array
    {
        return array_intersect_key($validated, array_flip([
            'product_name', 'sku', 'barcode', 'size', 'category',
        ]));
    }

    private function storeData(Store $store): array
    {
        return $store->only(['store_id', 'store_name', 'address', 'status']);
    }

    private function itemData(StoreInventory $item): array
    {
        return array_merge($item->product->only([
            'product_id', 'product_name', 'sku', 'barcode', 'size', 'category',
        ]), [
            'store_inventory_id' => $item->store_inventory_id,
            'store_id' => $item->store_id,
            'selling_price' => $item->selling_price,
            'hard_stock_qty' => $item->hard_stock_qty,
            'soft_stock_qty' => $item->soft_stock_qty,
            'status' => $item->status,
            'updated_at' => $item->updated_at?->toIso8601String(),
        ]);
    }
}
