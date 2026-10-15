<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SuperAdmin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

/**
 * Persistent supervisor notifications. Existing business events are reconciled
 * on GET, so no changes to teammates' order/inventory controllers are needed.
 * Reconciliation is polling-based, not push/realtime.
 */
class SupervisorNotificationController extends Controller
{
    private function supervisor(Request $request): SuperAdmin
    {
        $user = $request->user();
        abort_unless($user instanceof SuperAdmin && $user->role_type === 'Supervisor', 403, 'Supervisor access required.');
        return $user;
    }

    public function index(Request $request): JsonResponse
    {
        $supervisor = $this->supervisor($request);
        $validated = $request->validate([
            'type' => ['sometimes', Rule::in(['order', 'stock', 'pickup'])],
            'unread_only' => ['sometimes', 'boolean'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);
        $this->syncEvents((int) $supervisor->admin_id);

        $query = DB::table('supervisor_notifications')->where('admin_id', $supervisor->admin_id);
        if (isset($validated['type'])) $query->where('type', $validated['type']);
        if ($request->boolean('unread_only')) $query->whereNull('read_at');

        $rows = $query->orderByDesc('created_at')->orderByDesc('id')->paginate((int) ($validated['per_page'] ?? 20));
        $rows->getCollection()->transform(function ($row) {
            $row->metadata = $row->metadata ? json_decode($row->metadata, true) : null;
            return $row;
        });
        return response()->json([
            'data' => $rows->items(),
            'unread_count' => DB::table('supervisor_notifications')->where('admin_id', $supervisor->admin_id)->whereNull('read_at')->count(),
            'pagination' => ['current_page' => $rows->currentPage(), 'last_page' => $rows->lastPage(), 'total' => $rows->total()],
        ]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $supervisor = $this->supervisor($request);
        $this->syncEvents((int) $supervisor->admin_id);
        return response()->json(['data' => [
            'unread_count' => DB::table('supervisor_notifications')->where('admin_id', $supervisor->admin_id)->whereNull('read_at')->count(),
        ]]);
    }

    public function markRead(Request $request, int $notification): JsonResponse
    {
        $supervisor = $this->supervisor($request);
        $query = DB::table('supervisor_notifications')->where('admin_id', $supervisor->admin_id)->where('id', $notification);
        abort_unless((clone $query)->exists(), 404, 'Notification not found.');
        (clone $query)->whereNull('read_at')->update(['read_at' => now(), 'updated_at' => now()]);
        return response()->json(['message' => 'Notification marked as read.', 'data' => $query->first()]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $supervisor = $this->supervisor($request);
        $updated = DB::table('supervisor_notifications')
            ->where('admin_id', $supervisor->admin_id)
            ->whereNull('read_at')
            ->update(['read_at' => now(), 'updated_at' => now()]);
        return response()->json(['message' => 'All notifications marked as read.', 'data' => ['updated' => $updated]]);
    }

    /** Inserts only unseen event keys; already-read notifications stay read. */
    private function record(int $adminId, string $key, string $type, string $title, string $message, array $metadata): void
    {
        DB::table('supervisor_notifications')->insertOrIgnore([
            'admin_id' => $adminId,
            'event_key' => $key,
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'metadata' => json_encode($metadata, JSON_THROW_ON_ERROR),
            'read_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function syncEvents(int $adminId): void
    {
        // Each assignment is addressed to the supervisor who assigned the worker.
        DB::table('worker_assignments')
            ->where('admin_id', $adminId)
            ->orderByDesc('assignment_id')
            ->limit(500)
            ->get(['assignment_id', 'order_id', 'worker_id'])
            ->each(function ($assignment) use ($adminId) {
                $this->record($adminId, 'assignment:'.$assignment->assignment_id, 'order',
                    'Worker assigned to order',
                    "Order #{$assignment->order_id} was assigned to worker #{$assignment->worker_id}.",
                    ['order_id' => $assignment->order_id, 'worker_id' => $assignment->worker_id, 'assignment_id' => $assignment->assignment_id]);
            });

        // Pickup notifications are for orders assigned by this supervisor.
        DB::table('orders')
            ->join('worker_assignments', 'orders.order_id', '=', 'worker_assignments.order_id')
            ->where('worker_assignments.admin_id', $adminId)
            ->where('orders.order_status', 'Ready for Pickup')
            ->distinct()
            ->orderByDesc('orders.order_id')
            ->limit(500)
            ->get(['orders.order_id'])
            ->each(function ($order) use ($adminId) {
                $this->record($adminId, 'pickup:'.$order->order_id, 'pickup',
                    'Order ready for pickup', "Order #{$order->order_id} is ready for pickup.",
                    ['order_id' => $order->order_id]);
            });

        // Stock alerts are store-wide because this database does not define
        // a supervisor-to-store relationship. Only configured policies are used.
        if (!Schema::hasTable('stock_policies')) return;
        DB::table('store_inventory as si')
            ->join('stock_policies as sp', function ($join) {
                $join->on('sp.store_id', '=', 'si.store_id')
                    ->on('sp.product_id', '=', 'si.product_id');
            })
            ->join('products as p', 'p.product_id', '=', 'si.product_id')
            ->where('sp.enabled', true)
            ->whereColumn('si.hard_stock_qty', '<=', 'sp.low_stock_threshold')
            ->orderBy('si.store_inventory_id')
            ->limit(500)
            ->get(['si.store_inventory_id', 'si.store_id', 'si.product_id', 'si.hard_stock_qty', 'sp.low_stock_threshold', 'p.product_name'])
            ->each(function ($item) use ($adminId) {
                // Deduplicate one low-stock alert per inventory record.
                // Re-alerting after restock requires a separate event hook.
                $stateKey = 'stock-active:'.$item->store_inventory_id;
                $state = DB::table('supervisor_notifications')->where('admin_id', $adminId)->where('event_key', $stateKey)->first();
                if ($state) return;
                $this->record($adminId, $stateKey, 'stock', 'Low stock alert',
                    "{$item->product_name} at store #{$item->store_id} has {$item->hard_stock_qty} units (threshold: {$item->low_stock_threshold}).",
                    ['store_id' => $item->store_id, 'product_id' => $item->product_id, 'store_inventory_id' => $item->store_inventory_id]);
            });
    }
}
