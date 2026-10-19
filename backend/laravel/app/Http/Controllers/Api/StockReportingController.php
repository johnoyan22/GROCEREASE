<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryAvailabilityLog;
use App\Models\LowStockReport;
use App\Services\StoreStaffAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class StockReportingController extends Controller
{
    private StoreStaffAccess $access;

    public function __construct(StoreStaffAccess $access)
    {
        $this->access = $access;
    }

    public function index(Request $request): JsonResponse
    {
        return DB::transaction(function () use ($request) {
            $context = $this->access->resolve($request->user(), ['inventory_worker', 'supervisor']);
            $store = $context['store'];
            $request->validate($this->protectedFields());
            $this->requireReportingSchema();
            $reports = LowStockReport::query()->where('store_id', $store->store_id)
                ->with(['inventory.product', 'reportedBy.profile'])->orderByDesc('id')->get();
            $rows = [];
            foreach ($reports as $report) {
                $rows[] = $this->reportData($report);
            }

            return response()->json([
                'store' => $store->only(['store_id', 'store_name', 'address', 'status']),
                'reports' => $rows,
            ]);
        }, 3);
    }

    public function store(Request $request, int $item): JsonResponse
    {
        return DB::transaction(function () use ($request, $item) {
            $context = $this->access->resolve($request->user(), ['inventory_worker']);
            $store = $context['store'];
            $inventory = $this->access->inventory($store, $item);
            $rules = $this->protectedFields();
            $rules['note'] = ['required', 'string', 'max:1000'];
            $validated = $request->validate($rules);
            $this->requireReportingSchema();
            $report = LowStockReport::create([
                'store_id' => $store->store_id,
                'store_inventory_id' => $inventory->store_inventory_id,
                'reported_by_user_id' => $context['user']->id,
                'note' => $validated['note'],
                'observed_hard_stock_qty' => $inventory->hard_stock_qty,
                'observed_soft_stock_qty' => $inventory->soft_stock_qty,
            ]);

            return response()->json([
                'message' => 'Low-stock report recorded. Inventory quantities are unchanged.',
                'report' => $this->reportData($report->load(['inventory.product', 'reportedBy.profile'])),
            ], 201);
        }, 3);
    }

    public function availabilityHistory(Request $request): JsonResponse
    {
        return DB::transaction(function () use ($request) {
            $context = $this->access->resolve($request->user(), ['inventory_worker', 'supervisor']);
            $store = $context['store'];
            $request->validate($this->protectedFields());
            $this->requireReportingSchema();
            $logs = InventoryAvailabilityLog::query()->where('store_id', $store->store_id)
                ->with(['inventory.product', 'changedBy.profile'])->orderByDesc('id')->get();
            $rows = [];
            foreach ($logs as $log) {
                $rows[] = [
                    'id' => $log->id,
                    'store_id' => $log->store_id,
                    'store_inventory_id' => $log->store_inventory_id,
                    'product_name' => $log->inventory->product->product_name,
                    'sku' => $log->inventory->product->sku,
                    'changed_by_user_id' => $log->changed_by_user_id,
                    'changed_by_name' => $this->personName($log->changedBy),
                    'previous_status' => $log->previous_status,
                    'new_status' => $log->new_status,
                    'created_at' => $log->created_at->toIso8601String(),
                ];
            }

            return response()->json([
                'store' => $store->only(['store_id', 'store_name', 'address', 'status']),
                'history' => $rows,
            ]);
        }, 3);
    }

    private function reportData(LowStockReport $report): array
    {
        return [
            'id' => $report->id,
            'store_id' => $report->store_id,
            'store_inventory_id' => $report->store_inventory_id,
            'product_name' => $report->inventory->product->product_name,
            'sku' => $report->inventory->product->sku,
            'note' => $report->note,
            'reported_by_user_id' => $report->reported_by_user_id,
            'reported_by_name' => $this->personName($report->reportedBy),
            'observed_hard_stock_qty' => $report->observed_hard_stock_qty,
            'observed_soft_stock_qty' => $report->observed_soft_stock_qty,
            'created_at' => $report->created_at->toIso8601String(),
        ];
    }

    private function personName($user): string
    {
        $name = trim(($user->profile?->first_name ?? '').' '.($user->profile?->last_name ?? ''));
        if ($name === '') {
            return 'User #'.$user->id;
        }

        return $name;
    }

    private function requireReportingSchema(): void
    {
        if (! Schema::hasTable('low_stock_reports') || ! Schema::hasTable('inventory_availability_logs')) {
            abort(503, 'Stock reporting is awaiting database setup. Please contact your administrator.');
        }
    }

    private function protectedFields(): array
    {
        return array_fill_keys([
            'store_id', 'user_id', 'role', 'role_id', 'assigned_by_user_id',
            'store_inventory_id', 'product_id', 'reported_by_user_id', 'changed_by_user_id',
            'hard_stock_qty', 'soft_stock_qty', 'observed_hard_stock_qty', 'observed_soft_stock_qty',
            'status', 'previous_status', 'new_status', 'created_at', 'updated_at',
        ], ['prohibited']);
    }
}
