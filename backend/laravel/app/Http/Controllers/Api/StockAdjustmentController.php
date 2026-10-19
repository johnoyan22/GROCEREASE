<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryPolicyLog;
use App\Models\StockAdjustment;
use App\Models\User;
use App\Services\StoreStaffAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class StockAdjustmentController extends Controller
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
            $request->validate($this->protectedFields());
            $this->requireStockSchema();
            $adjustments = StockAdjustment::where('store_id', $context['store']->store_id)
                ->with(['inventory.product', 'requestedBy.profile', 'decidedBy.profile'])->orderByDesc('id')->get();
            $rows = [];
            foreach ($adjustments as $adjustment) {
                $rows[] = $this->adjustmentData($adjustment);
            }

            return response()->json([
                'store' => $context['store']->only(['store_id', 'store_name', 'address', 'status']),
                'adjustments' => $rows,
            ]);
        }, 3);
    }

    public function store(Request $request, int $item): JsonResponse
    {
        return DB::transaction(function () use ($request, $item) {
            $context = $this->access->resolve($request->user(), ['inventory_worker']);
            $this->requireStockSchema();
            $inventory = $this->access->inventory($context['store'], $item);
            $validated = $request->validate(array_merge($this->protectedFields(), [
                'requested_hard_stock_qty' => ['required', 'integer', 'min:0', 'max:2147483647'],
                'expected_stock_version' => ['required', 'integer', 'min:0'],
                'reason' => ['required', 'string', 'max:1000'],
            ]));
            if ((int) $validated['expected_stock_version'] !== $inventory->stock_version) {
                abort(409, 'Stock changed. Refresh inventory and submit a new physical count.');
            }
            if ((int) $validated['requested_hard_stock_qty'] < $inventory->soft_stock_qty) {
                throw ValidationException::withMessages([
                    'requested_hard_stock_qty' => 'The physical count cannot be below reserved units. Contact your Supervisor for reconciliation.',
                ]);
            }
            $adjustment = StockAdjustment::create([
                'store_id' => $context['store']->store_id,
                'store_inventory_id' => $inventory->store_inventory_id,
                'requested_by_user_id' => $context['user']->id,
                'observed_hard_stock_qty' => $inventory->hard_stock_qty,
                'observed_soft_stock_qty' => $inventory->soft_stock_qty,
                'observed_stock_version' => $inventory->stock_version,
                'requested_hard_stock_qty' => $validated['requested_hard_stock_qty'],
                'reason' => $validated['reason'],
                'status' => 'pending',
            ]);

            return response()->json([
                'message' => 'Physical-count correction submitted for Supervisor approval. Stock is unchanged.',
                'adjustment' => $this->adjustmentData($adjustment->load(['inventory.product', 'requestedBy.profile', 'decidedBy.profile'])),
            ], 201);
        }, 3);
    }

    public function decide(Request $request, int $adjustment): JsonResponse
    {
        return DB::transaction(function () use ($request, $adjustment) {
            $context = $this->access->resolve($request->user(), ['supervisor']);
            $this->requireStockSchema();
            $record = StockAdjustment::where('store_id', $context['store']->store_id)
                ->whereKey($adjustment)->lockForUpdate()->firstOrFail();
            $inventory = $this->access->inventory($context['store'], $record->store_inventory_id);
            $record->setRelation('inventory', $inventory);
            $validated = $request->validate(array_merge($this->protectedFields(), [
                'decision' => ['required', Rule::in(['approved', 'rejected'])],
                'decision_note' => ['required_if:decision,rejected', 'nullable', 'string', 'max:1000'],
                'requested_hard_stock_qty' => ['prohibited'],
                'expected_stock_version' => ['prohibited'],
                'reason' => ['prohibited'],
            ]));
            if ($record->status !== 'pending') {
                abort(409, 'This request has already been decided. Refresh the request history.');
            }

            if ($validated['decision'] === 'approved') {
                if ($record->requested_by_user_id === $context['user']->id) {
                    abort(403, 'You cannot approve your own stock correction.');
                }
                if ($this->isStale($record)) {
                    abort(409, 'Stock changed after this request. Reject it and request a new physical count.');
                }
                if ($record->requested_hard_stock_qty < $inventory->soft_stock_qty) {
                    abort(409, 'The physical count cannot be below reserved units. Reconciliation is required.');
                }
                $inventory->hard_stock_qty = $record->requested_hard_stock_qty;
                $inventory->stock_version = $inventory->stock_version + 1;
                $inventory->save();
            }

            $record->status = $validated['decision'];
            $record->decided_by_user_id = $context['user']->id;
            $record->decision_note = $validated['decision_note'] ?? null;
            $record->decided_at = now();
            $record->save();
            $record->setRelation('inventory', $inventory->load('product'));

            return response()->json([
                'message' => 'Stock correction '.$record->status.'.',
                'adjustment' => $this->adjustmentData($record->load(['requestedBy.profile', 'decidedBy.profile'])),
            ]);
        }, 3);
    }

    public function updatePolicy(Request $request, int $item): JsonResponse
    {
        return DB::transaction(function () use ($request, $item) {
            $context = $this->access->resolve($request->user(), ['supervisor']);
            $this->requireStockSchema();
            $inventory = $this->access->inventory($context['store'], $item);
            $validated = $request->validate(array_merge($this->protectedFields(), [
                'max_per_order' => ['present', 'nullable', 'integer', 'min:1', 'max:2147483647'],
                'low_stock_threshold' => ['present', 'nullable', 'integer', 'min:0', 'max:2147483647'],
            ]));
            $limit = null;
            $threshold = null;
            if ($validated['max_per_order'] !== null) {
                $limit = (int) $validated['max_per_order'];
            }
            if ($validated['low_stock_threshold'] !== null) {
                $threshold = (int) $validated['low_stock_threshold'];
            }
            if ($inventory->max_per_order !== $limit || $inventory->low_stock_threshold !== $threshold) {
                InventoryPolicyLog::create([
                    'store_id' => $context['store']->store_id,
                    'store_inventory_id' => $inventory->store_inventory_id,
                    'changed_by_user_id' => $context['user']->id,
                    'previous_max_per_order' => $inventory->max_per_order,
                    'new_max_per_order' => $limit,
                    'previous_low_stock_threshold' => $inventory->low_stock_threshold,
                    'new_low_stock_threshold' => $threshold,
                ]);
                $inventory->max_per_order = $limit;
                $inventory->low_stock_threshold = $threshold;
                $inventory->save();
            }

            return response()->json(['message' => 'Product quantity limit and low-stock threshold saved.']);
        }, 3);
    }

    private function isStale(StockAdjustment $adjustment): bool
    {
        // Version detects a count that changed and later returned to the same number.
        $inventory = $adjustment->inventory;
        return $adjustment->observed_stock_version !== $inventory->stock_version
            || $adjustment->observed_hard_stock_qty !== $inventory->hard_stock_qty
            || $adjustment->observed_soft_stock_qty !== $inventory->soft_stock_qty;
    }

    private function adjustmentData(StockAdjustment $adjustment): array
    {
        return [
            'id' => $adjustment->id,
            'store_id' => $adjustment->store_id,
            'store_inventory_id' => $adjustment->store_inventory_id,
            'product_name' => $adjustment->inventory->product->product_name,
            'sku' => $adjustment->inventory->product->sku,
            'requested_by_user_id' => $adjustment->requested_by_user_id,
            'requested_by_name' => $this->personName($adjustment->requestedBy),
            'observed_hard_stock_qty' => $adjustment->observed_hard_stock_qty,
            'observed_soft_stock_qty' => $adjustment->observed_soft_stock_qty,
            'requested_hard_stock_qty' => $adjustment->requested_hard_stock_qty,
            'current_hard_stock_qty' => $adjustment->inventory->hard_stock_qty,
            'current_soft_stock_qty' => $adjustment->inventory->soft_stock_qty,
            'is_stale' => $adjustment->status === 'pending' && $this->isStale($adjustment),
            'reason' => $adjustment->reason,
            'status' => $adjustment->status,
            'decided_by_user_id' => $adjustment->decided_by_user_id,
            'decided_by_name' => $this->personName($adjustment->decidedBy),
            'decision_note' => $adjustment->decision_note,
            'decided_at' => $adjustment->decided_at?->toIso8601String(),
            'created_at' => $adjustment->created_at->toIso8601String(),
        ];
    }

    private function personName(?User $user): ?string
    {
        if (! $user) {
            return null;
        }
        $name = trim(($user->profile?->first_name ?? '').' '.($user->profile?->last_name ?? ''));
        if ($name === '') {
            return 'User #'.$user->id;
        }
        return $name;
    }

    private function requireStockSchema(): void
    {
        if (! Schema::hasTable('stock_adjustments') || ! Schema::hasTable('inventory_policy_logs')) {
            abort(503, 'Stock corrections are awaiting database setup. Please contact your administrator.');
        }
    }

    private function protectedFields(): array
    {
        return array_fill_keys([
            'store_id', 'user_id', 'role', 'role_id', 'assigned_by_user_id', 'product_id', 'store_inventory_id',
            'requested_by_user_id', 'decided_by_user_id', 'status', 'decided_at', 'created_at', 'updated_at',
            'observed_hard_stock_qty', 'observed_soft_stock_qty', 'observed_stock_version',
            'hard_stock_qty', 'soft_stock_qty', 'stock_version',
        ], ['prohibited']);
    }
}
