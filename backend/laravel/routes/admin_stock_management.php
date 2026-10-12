<?php
/**
 * GrocerEase Admin Stock Management (Laravel 12)
 * Place in: backend/laravel/routes/admin_stock_management.php
 * Register inside routes/api.php: require __DIR__.'/admin_stock_management.php';
 *
 * Assumptions to verify against your project:
 * - auth:sanctum resolves the logged-in user
 * - Admin authorization is represented by users.role_type === 'Admin' OR users.role === 'Admin'
 * - products table has product_id primary key
 * - store_inventory table has store_id, product_id, hard_stock_qty
 *
 * Policy fields are configurable, not claimed to come from the manuscript.
 * Run php artisan migrate after adding the accompanying migration file.
 */

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

// Database tables are created only by the accompanying Laravel migration.

Route::middleware('auth:sanctum')->prefix('admin/stock-management')->group(function () {
    $assertAdmin = static function (Request $request): void {
        $user = $request->user();
        abort_unless($user && in_array(strtolower((string) ($user->role_type ?? $user->role ?? '')), ['admin', 'administrator'], true), 403, 'Admin access required.');
    };

    Route::get('/policies', function (Request $request) use ($assertAdmin) {
        $assertAdmin($request);
        return response()->json(['data' => DB::table('stock_policies')->orderBy('store_id')->orderBy('product_id')->paginate(25)]);
    });

    Route::put('/policies/{storeId}/{productId}', function (Request $request, int $storeId, int $productId) use ($assertAdmin) {
        $assertAdmin($request);
        $data = $request->validate([
            'max_per_order' => ['required', 'integer', 'min:1', 'max:1000000'],
            'low_stock_threshold' => ['required', 'integer', 'min:0', 'max:1000000'],
            'enabled' => ['required', 'boolean'],
        ]);
        abort_unless(DB::table('products')->where('product_id', $productId)->exists(), 404, 'Product not found.');
        abort_unless(DB::table('stores')->where('store_id', $storeId)->exists(), 404, 'Store not found.');
        DB::table('stock_policies')->updateOrInsert(
            ['store_id' => $storeId, 'product_id' => $productId],
            array_merge($data, ['updated_at' => now()])
        );
        return response()->json(['message' => 'Stock policy saved.', 'data' => DB::table('stock_policies')->where('store_id', $storeId)->where('product_id', $productId)->first()]);
    });

    Route::get('/policies/{storeId}/{productId}', function (Request $request, int $storeId, int $productId) use ($assertAdmin) {
        $assertAdmin($request);
        $policy = DB::table('stock_policies')->where('store_id', $storeId)->where('product_id', $productId)->first();
        abort_unless($policy, 404, 'Policy not found.');
        return response()->json(['data' => $policy]);
    });
});

// Cart/Checkout must call this shared read-only validation endpoint server-side.
// This endpoint alone does NOT enforce limits on existing Cart/Checkout writes.
Route::middleware('auth:sanctum')->post('/stock-management/validate-cart', function (Request $request) {
    $data = $request->validate([
        'store_id' => ['required', 'integer', 'min:1'],
        'items' => ['required', 'array', 'min:1'],
        'items.*.product_id' => ['required', 'integer', 'min:1'],
        'items.*.quantity' => ['required', 'integer', 'min:1'],
    ]);
    $grouped = collect($data['items'])->groupBy('product_id');
    $errors = [];
    foreach ($grouped as $productId => $items) {
        $quantity = $items->sum('quantity');
        $policy = DB::table('stock_policies')->where('store_id', $data['store_id'])->where('product_id', $productId)->first();
        $inventory = DB::table('store_inventory')->where('store_id', $data['store_id'])->where('product_id', $productId)->first();
        if (!$inventory) {
            $errors[] = ['product_id' => (int) $productId, 'message' => 'Product unavailable in selected store.'];
            continue;
        }
        if ($policy && !$policy->enabled) {
            $errors[] = ['product_id' => (int) $productId, 'message' => 'Product is disabled for ordering.'];
        }
        if ($policy && $quantity > $policy->max_per_order) {
            $errors[] = ['product_id' => (int) $productId, 'message' => 'Quantity exceeds per-order limit.'];
        }
        if ($quantity > $inventory->hard_stock_qty) {
            $errors[] = ['product_id' => (int) $productId, 'message' => 'Quantity exceeds available stock.'];
        }
    }
    return response()->json(['valid' => count($errors) === 0, 'errors' => $errors], count($errors) ? 422 : 200);
});
