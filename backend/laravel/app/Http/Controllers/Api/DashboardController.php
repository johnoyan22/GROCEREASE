<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\StoreInventory;
use App\Models\User;
use App\Services\PaymentEvidence;
use App\Services\StoreStaffAccess;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DashboardController extends Controller
{
    public function summary(Request $request, StoreStaffAccess $access): JsonResponse
    {
        $request->validate(['store_id' => ['prohibited'], 'shopper_user_id' => ['prohibited'], 'user_id' => ['prohibited']]);
        return DB::transaction(function () use ($request, $access) {
            $role = $request->user()->role?->slug;
            $start = CarbonImmutable::now('Asia/Manila')->startOfDay()->utc();
            $end = $start->addDay();
            $base = ['role' => $role, 'server_time' => now()->toIso8601String(), 'timezone' => 'Asia/Manila',
                'reporting_period' => ['start' => $start->toIso8601String(), 'end_exclusive' => $end->toIso8601String()]];
            foreach (['orders', 'order_items', 'order_notifications', 'store_inventory', 'stock_adjustments', 'cop_strikes', 'order_payments'] as $table) {
                abort_unless(Schema::hasTable($table), 503, 'Dashboard data is awaiting database setup.');
            }
            if ($role === 'shopper') {
                abort_unless($request->user()->hasVerifiedEmail(), 403, 'Verify your email first.');
                $active = Order::active()->where('shopper_user_id', $request->user()->id);
                $recent = (clone $active)->orderByDesc('order_id')->limit(5)->get();
                return response()->json([...$base, 'active_orders' => $active->count(),
                    'recent_active_orders' => $recent->map(fn ($order) => [
                        ...$order->only(['order_id', 'store_id', 'store_name', 'status', 'payment_status', 'payment_method', 'total_centavos', 'pickup_window_start_at', 'pickup_window_end_at']),
                        'item_quantity' => (int) $order->items()->sum('quantity'),
                    ]),
                    'unread_notifications' => DB::table('order_notifications')->where('user_id', $request->user()->id)->whereNull('read_at')->count()]);
            }
            if ($role === 'admin') return response()->json([...$base, ...$this->admin($start, $end)]);

            $context = $access->resolve($request->user(), ['inventory_worker', 'supervisor']);
            $storeId = $context['store']->store_id;
            $inventory = StoreInventory::forStore($storeId)->with('product')->get();
            $active = $inventory->where('status', 'active');
            $orders = Order::active()->where('store_id', $storeId);
            $busy = DB::table('workers')->where('workers.store_id', $storeId)->where('workers.status', 'active')
                ->whereExists(fn ($q) => $q->selectRaw('1')->from('active_worker_assignments')->whereColumn('active_worker_assignments.worker_id', 'workers.worker_id'));
            $adjustments = DB::table('stock_adjustments')->where('store_id', $storeId);
            return response()->json([...$base,
                'store' => $context['store']->only(['store_id', 'store_name', 'address']),
                'active_orders' => (clone $orders)->count(), 'waiting_orders' => (clone $orders)->where('status', 'waiting')->count(),
                'preparing_orders' => (clone $orders)->where('status', 'preparing')->count(),
                'ready_orders' => (clone $orders)->where('status', 'ready_for_pickup')->count(),
                'schedule_reviews' => Order::where('store_id', $storeId)->where('reservation_status', 'active')->where('pickup_schedule_review_required', true)->count(),
                'busy_workers' => (clone $busy)->count(),
                'available_workers' => DB::table('workers')->where('store_id', $storeId)->where('status', 'active')->count() - (clone $busy)->count(),
                'products_managed' => $active->count(), 'inventory_records' => $inventory->count(),
                'physical_units' => (int) $inventory->sum('hard_stock_qty'), 'reserved_units' => (int) $inventory->sum('soft_stock_qty'),
                'available_units' => (int) $inventory->sum(fn ($row) => $row->availableStock()),
                'low_stock_products' => $active->filter(fn ($row) => $row->isLowStock())->count(),
                'stock_statuses' => [
                    'in_stock' => $active->filter(fn ($row) => $row->availableStock() > 0 && !$row->isLowStock())->count(),
                    'low_stock' => $active->filter(fn ($row) => $row->availableStock() > 0 && $row->isLowStock())->count(),
                    'out_of_stock' => $active->filter(fn ($row) => $row->availableStock() === 0)->count(),
                    'inactive' => $inventory->where('status', 'inactive')->count(),
                ],
                'pending_stock_approvals' => (clone $adjustments)->where('status', 'pending')->count(),
                'stock_updates_today' => (clone $adjustments)->where('status', 'approved')->where('decided_at', '>=', $start)->where('decided_at', '<', $end)->count(),
                'recent_adjustments' => (clone $adjustments)->orderByDesc('updated_at')->orderByDesc('id')->limit(5)->get(['id', 'store_inventory_id', 'status', 'reason', 'updated_at']),
                'recent_reports' => DB::table('low_stock_reports')->where('store_id', $storeId)->orderByDesc('id')->limit(5)->get(['id', 'store_inventory_id', 'note', 'created_at']),
                'recent_activity' => DB::table('inventory_availability_logs')->where('store_id', $storeId)->orderByDesc('id')->limit(5)->get(['id', 'store_inventory_id', 'previous_status', 'new_status', 'created_at']),
            ]);
        }, 3)->header('Cache-Control', 'no-store');
    }

    private function admin(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $restricted = DB::table('cop_strikes')->whereNull('voided_at')->groupBy('shopper_user_id')
            ->selectRaw('shopper_user_id, COUNT(*) as strikes, MAX(issued_at) as latest_strike')->get()
            ->filter(fn ($row) => $row->strikes >= 3 || ($row->strikes == 2 && CarbonImmutable::parse($row->latest_strike, 'UTC')->addDays(30)->isFuture()));
        // Gross verified supermarket payments confirmed in this Manila day; subscription revenue is separate.
        $payments = DB::table('order_payments')->where('confirmed_at', '>=', $start)->where('confirmed_at', '<', $end)->get();
        $orders = Order::whereIn('order_id', $payments->pluck('order_id'))->get()->keyBy('order_id');
        $sales = 0;
        foreach ($payments as $payment) {
            $order = $orders->get($payment->order_id);
            if ($order && $order->refund_status !== 'completed' && app(PaymentEvidence::class)->valid($order, $payment)) $sales += (int) $payment->amount_centavos;
        }
        $low = StoreInventory::where('status', 'active')->whereNotNull('low_stock_threshold')
            ->whereRaw('(hard_stock_qty - soft_stock_qty) <= low_stock_threshold');
        return ['total_users' => User::count(), 'active_orders' => Order::active()->count(),
            'low_stock_products' => (clone $low)->count(), 'cop_restricted_accounts' => $restricted->count(),
            'todays_sales_centavos' => $sales, 'service_charge_pool_centavos' => null, 'subscription_revenue_centavos' => null,
            'roles' => DB::table('roles')->leftJoin('users', 'users.role_id', '=', 'roles.role_id')
                ->groupBy('roles.role_id', 'roles.name', 'roles.slug')->selectRaw('roles.name, roles.slug, COUNT(users.id) as user_count')->get(),
            'low_stock_records' => (clone $low)->with(['store', 'product'])->orderBy('store_id')->orderBy('store_inventory_id')->limit(5)->get()->map(fn ($row) => [
                'store_inventory_id' => $row->store_inventory_id, 'store_name' => $row->store->store_name,
                'product_name' => $row->product->product_name, 'available_stock' => $row->availableStock(), 'low_stock_threshold' => $row->low_stock_threshold,
            ]),
            'restricted_accounts' => $restricted->take(5)->map(fn ($row) => ['user_id' => $row->shopper_user_id, 'strike_count' => (int) $row->strikes])->values(),
        ];
    }
}
