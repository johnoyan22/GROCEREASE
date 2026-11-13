<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Store;
use App\Models\StoreInventory;
use App\Models\User;
use App\Services\OrderData;
use App\Services\PickupPolicy;
use App\Services\OrderNotifications;
use App\Services\WorkerDelegation;
use App\Services\StoreStaffAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    public function lookup(Request $request, OrderData $data, StoreStaffAccess $access): JsonResponse
    {
        $input = $request->validate(['reference' => ['required', 'string', 'max:100', 'regex:/^(?:[0-9]+|GE-[0-9]+(?:-[0-9]+)?|TX-[0-9]+)$/i'], 'store_id' => ['prohibited']]);
        return DB::transaction(function () use ($request, $input, $data, $access) {
            $context = $access->resolve($request->user(), ['supervisor']); $data->requireSchema();
            $reference = strtoupper(trim($input['reference']));
            $query = Order::where('store_id', $context['store']->store_id);
            if (str_starts_with($reference, 'TX-')) {
                $query->whereIn('order_id', DB::table('order_payments')->where('id', substr($reference, 3))->select('order_id'));
            } elseif (preg_match('/^GE-([0-9]+)-([0-9]+)$/', $reference, $parts)) {
                $query->whereKey($parts[1])->whereIn('order_id', DB::table('order_handovers')->where('id', $parts[2])->select('order_id'));
            } else { $query->whereKey(str_starts_with($reference, 'GE-') ? substr($reference, 3) : $reference); }
            $record = $query->lockForUpdate()->first();
            abort_unless($record, 404, 'This reference is unavailable in your assigned active store. Check the order ID or receipt / transaction reference.');
            $notice = match (true) {
                $record->status === 'completed' => 'This order is already completed. Another handover is not permitted.',
                $record->status === 'canceled' => 'This order was canceled and cannot be claimed.',
                $record->claim_status !== 'claimable' || $record->status !== 'ready_for_pickup' => 'This order is not currently ready for claiming. Review preparation and claim status.',
                default => 'Continue through QR/PIN, claimant verification, cashier/provider payment confirmation and physical handover.',
            };
            return response()->json(['order' => $data->present($record, true), 'notice' => $notice]);
        }, 3);
    }

    public function shopperIndex(Request $request, OrderData $data): JsonResponse
    {
        $data->requireSchema();
        $orders = Order::where('shopper_user_id', $request->user()->id)->with(['items', 'history'])->orderByDesc('order_id')->get();
        $rows = [];
        foreach ($orders as $order) $rows[] = $data->present($order);
        return response()->json(['orders' => $rows, 'server_time' => now()->toIso8601String()]);
    }

    public function shopperShow(Request $request, int $order, OrderData $data): JsonResponse
    {
        $data->requireSchema();
        $record = Order::where('shopper_user_id', $request->user()->id)->whereKey($order)->firstOrFail();
        return response()->json(['order' => $data->present($record)]);
    }

    public function staffIndex(Request $request, OrderData $data, StoreStaffAccess $access): JsonResponse
    {
        return DB::transaction(function () use ($request, $data, $access) {
            $context = $access->resolve($request->user(), ['inventory_worker', 'supervisor']);
            $request->validate(['store_id' => ['prohibited'], 'shopper_user_id' => ['prohibited']]);
            $data->requireSchema();
            $orders = Order::where('store_id', $context['store']->store_id)->orderBy('pickup_window_start_at')->orderBy('order_id')->lockForUpdate()->get();
            $rows = [];
            foreach ($orders as $order) $rows[] = $data->present($order, true);
            return response()->json(['store' => $context['store']->only(['store_id', 'store_name', 'address']), 'orders' => $rows, 'server_time' => now()->toIso8601String()]);
        }, 3);
    }

    public function updateStatus(Request $request, int $order, OrderData $data, StoreStaffAccess $access): JsonResponse
    {
        return DB::transaction(function () use ($request, $order, $data, $access) {
            $context = $access->resolve($request->user(), ['supervisor']);
            $data->requireSchema();
            $record = Order::where('store_id', $context['store']->store_id)->whereKey($order)->lockForUpdate()->firstOrFail();
            abort_if($record->payment_method === 'digital' && $record->payment_status !== 'paid', 409, 'Digital orders require trusted payment confirmation before preparation.');
            $validated = $request->validate([
                'status' => ['required', Rule::in(['preparing', 'ready_for_pickup'])],
                'store_id' => ['prohibited'], 'changed_by_user_id' => ['prohibited'],
                'payment_status' => ['prohibited'], 'reservation_status' => ['prohibited'],
                'shopper_user_id' => ['prohibited'], 'total_centavos' => ['prohibited'],
            ]);
            $next = ['waiting' => 'preparing', 'preparing' => 'ready_for_pickup'];
            if (($next[$record->status] ?? null) !== $validated['status'] || $record->reservation_status !== 'active') {
                abort(409, 'This order status transition is not allowed. Refresh the order.');
            }
            $previous = $record->status;
            if ($validated['status'] === 'preparing') {
                app(WorkerDelegation::class)->requireSchema();
                abort_unless(DB::table('active_worker_assignments')->where('order_id', $record->order_id)->lockForUpdate()->first(), 409, 'Assign an available worker before starting preparation.');
            }
            if ($validated['status'] === 'ready_for_pickup') {
                app(WorkerDelegation::class)->requireCompleted($record);
                app(PickupPolicy::class)->issue($record);
            }
            $record->status = $validated['status'];
            $record->save();
            app(OrderNotifications::class)->notify($record, 'status_'.$record->status, 'Order #'.$record->order_id.' is now '.str_replace('_', ' ', $record->status).'.');
            OrderStatusHistory::create([
                'order_id' => $record->order_id, 'changed_by_user_id' => $context['user']->id,
                'previous_status' => $previous, 'new_status' => $record->status,
            ]);
            return response()->json(['message' => 'Order status updated.', 'order' => $data->present($record, true)]);
        }, 3);
    }

    public function cancel(Request $request, int $order, OrderData $data): JsonResponse
    {
        $request->validate([
            'reason' => ['required', 'string', 'max:500'], 'status' => ['prohibited'],
            'shopper_user_id' => ['prohibited'], 'store_id' => ['prohibited'], 'payment_status' => ['prohibited'],
        ]);
        return DB::transaction(function () use ($request, $order, $data) {
            $user = User::with('role')->lockForUpdate()->findOrFail($request->user()->id);
            abort_unless($user->role?->slug === 'shopper' && $user->hasVerifiedEmail(), 403);
            $data->requireSchema();
            $initial = Order::where('shopper_user_id', $user->id)->whereKey($order)->firstOrFail();
            // Keep the same lock order as checkout and Supervisor operations.
            Store::whereKey($initial->store_id)->lockForUpdate()->firstOrFail();
            $record = Order::where('shopper_user_id', $user->id)->whereKey($order)->lockForUpdate()->firstOrFail();
            if ($record->status !== 'waiting' || $record->payment_status !== 'unpaid' || $record->reservation_status !== 'active') {
                abort(409, 'Only an unpaid Waiting order can be canceled.');
            }
            if ($record->payment_method === 'digital') {
                app(\App\Services\PaymentCheckout::class)->cancelLocked($record, $user->id, $request->input('reason'));
                return response()->json(['message' => 'Digital order canceled after provider expiry; reserved stock released.', 'order' => $data->present($record)]);
            }
            foreach ($record->items()->orderBy('store_inventory_id')->get() as $item) {
                $inventory = StoreInventory::forStore($record->store_id)->whereKey($item->store_inventory_id)->lockForUpdate()->firstOrFail();
                if ($inventory->soft_stock_qty < $item->quantity) {
                    abort(409, 'The reserved stock needs reconciliation. Contact your store Supervisor.');
                }
                // Waiting orders have not entered preparation. No automatic release for prepared/no-show goods.
                $inventory->soft_stock_qty = $inventory->soft_stock_qty - $item->quantity;
                $inventory->stock_version = $inventory->stock_version + 1;
                $inventory->save();
            }
            $record->status = 'canceled';
            app(WorkerDelegation::class)->cancelActive($record, $user->id, 'Shopper canceled the Waiting order.');
            $record->claim_status = 'canceled';
            $record->reservation_status = 'released';
            $record->canceled_at = now();
            $record->save();
            OrderStatusHistory::create([
                'order_id' => $record->order_id, 'changed_by_user_id' => $user->id,
                'previous_status' => 'waiting', 'new_status' => 'canceled', 'note' => $request->input('reason'),
            ]);
            return response()->json(['message' => 'Waiting order canceled. Its reservation was released.', 'order' => $data->present($record)]);
        }, 3);
    }
}
