<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StoreInventory;
use App\Services\LowStockMonitor;
use App\Services\StoreStaffAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LowStockController extends Controller
{
    public function index(Request $request, StoreStaffAccess $access, LowStockMonitor $monitor)
    {
        return DB::transaction(function () use ($request, $access, $monitor) {
            $context = $access->resolve($request->user(), ['inventory_worker', 'supervisor']);
            $monitor->requireSchema();
            $data = $request->validate([...$this->protectedFields(), 'search' => ['nullable', 'string', 'max:100'],
                'product' => ['nullable', 'integer', 'min:1'], 'store' => ['nullable', 'integer', 'min:1'],
                'page' => ['sometimes', 'integer', 'min:1', 'max:2147483647']]);
            $this->checkStore($context, $data);
            $own = StoreInventory::forStore($context['store']->store_id)->whereHas('product', fn ($q) => $q->forStore($context['store']->store_id));
            if (!empty($data['product'])) (clone $own)->whereKey($data['product'])->firstOrFail();
            $query = LowStockMonitor::lowQuery($own)->with('product');
            if (!empty($data['product'])) $query->whereKey($data['product']);
            $search = trim($data['search'] ?? '');
            if ($search !== '') $query->whereHas('product', fn ($q) => $q->where('product_name', 'like', '%'.$search.'%')->orWhere('sku', 'like', '%'.$search.'%'));
            [$page, $meta] = $this->pagination((clone $query)->count(), $data['page'] ?? 1);
            $items = $query->orderBy('store_inventory_id')->offset(($page - 1) * 10)->limit(10)->get()->map(fn ($item) => [
                ...$item->only(['store_id', 'store_inventory_id', 'hard_stock_qty', 'soft_stock_qty', 'low_stock_threshold', 'status', 'selling_price', 'max_per_order', 'stock_version']),
                ...$item->product->only(['product_id', 'product_name', 'sku', 'size', 'category', 'selling_unit']),
                'available_stock' => $item->availableStock(), 'is_low_stock' => true,
                'shortfall' => $item->low_stock_threshold - $item->hard_stock_qty,
            ]);
            return response()->json(['store' => $context['store']->only(['store_id', 'store_name', 'address']),
                'inventory' => $items, 'pagination' => $meta])->header('Cache-Control', 'no-store, private');
        }, 5);
    }

    public function notifications(Request $request, StoreStaffAccess $access, LowStockMonitor $monitor)
    {
        return DB::transaction(function () use ($request, $access, $monitor) {
            $context = $access->resolve($request->user(), ['inventory_worker', 'supervisor']);
            $monitor->requireSchema();
            $data = $request->validate([...$this->protectedFields(), 'page' => ['sometimes', 'integer', 'min:1', 'max:2147483647'],
                'unread' => ['sometimes', 'boolean']]);
            $query = DB::table('staff_low_stock_notifications')->where('user_id', $context['user']->id)->where('store_id', $context['store']->store_id);
            $unread = (clone $query)->whereNull('read_at')->count();
            if ($request->boolean('unread')) $query->whereNull('read_at');
            [$page, $meta] = $this->pagination((clone $query)->count(), $data['page'] ?? 1);
            $rows = $query->orderByDesc('id')->offset(($page - 1) * 10)->limit(10)->get()->map(function ($notice) use ($context) {
                $episode = DB::table('low_stock_episodes')->where('store_id', $context['store']->store_id)->where('id', $notice->episode_id)->first();
                $inventory = StoreInventory::forStore($context['store']->store_id)->findOrFail($episode->store_inventory_id);
                return ['id' => $notice->id, 'read_at' => $notice->read_at, 'delivered_at' => $notice->delivered_at,
                    'episode' => (array) $episode,
                    'current' => ['selling_unit' => $inventory->product->selling_unit, 'physical_quantity' => $inventory->hard_stock_qty, 'reorder_level' => $inventory->low_stock_threshold,
                        'is_low_stock' => $inventory->isLowStock(), 'status' => $inventory->status],
                    'link' => ($context['user']->role->slug === 'supervisor' ? '/supervisor/low-stock' : '/inventory/low-stock')
                        .'?store='.$context['store']->store_id.'&product='.$inventory->store_inventory_id];
            });
            return response()->json(['store' => $context['store']->only(['store_id', 'store_name', 'address']),
                'notifications' => $rows, 'unread_count' => $unread, 'pagination' => $meta])->header('Cache-Control', 'no-store, private');
        }, 5);
    }

    public function read(Request $request, int $notification, StoreStaffAccess $access, LowStockMonitor $monitor)
    {
        return DB::transaction(function () use ($request, $notification, $access, $monitor) {
            $context = $access->resolve($request->user(), ['inventory_worker', 'supervisor']);
            $monitor->requireSchema();
            $request->validate([...$this->protectedFields(), 'read_at' => ['prohibited'], 'episode_id' => ['prohibited']]);
            $row = DB::table('staff_low_stock_notifications')->where('id', $notification)->where('user_id', $context['user']->id)
                ->where('store_id', $context['store']->store_id)->lockForUpdate()->first();
            abort_unless($row, 404);
            if (!$row->read_at) DB::table('staff_low_stock_notifications')->where('id', $row->id)->update(['read_at' => now()]);
            return response()->json(['message' => 'Notification marked as read. The stock condition is unchanged.']);
        }, 5);
    }

    private function pagination(int $total, int $requested): array
    {
        $last = max(1, (int) ceil($total / 10)); $page = min($requested, $last);
        return [$page, ['current_page' => $page, 'last_page' => $last, 'per_page' => 10, 'total' => $total,
            'from' => $total ? ($page - 1) * 10 + 1 : null, 'to' => $total ? min($page * 10, $total) : null]];
    }

    private function checkStore(array $context, array $data): void
    {
        abort_if(isset($data['store']) && (int) $data['store'] !== (int) $context['store']->store_id,
            409, 'This link belongs to a different store assignment. Open Low Stock Monitoring for your current store.');
    }

    private function protectedFields(): array
    {
        return array_fill_keys(['store_id', 'user_id', 'role', 'role_id', 'per_page', 'hard_stock_qty', 'status'], ['prohibited']);
    }
}
