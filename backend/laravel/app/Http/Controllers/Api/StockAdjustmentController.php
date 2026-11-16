<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryPolicyLog;
use App\Models\InventoryBatch;
use App\Models\StoreInventory;
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
                ->with(['inventory.product', 'batch', 'requestedBy.profile', 'decidedBy.profile'])->orderByDesc('id')->get();
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

    public function batches(Request $request): JsonResponse
    {
        return DB::transaction(function () use ($request) {
            $context = $this->access->resolve($request->user(), ['inventory_worker', 'supervisor']);
            $this->requireStockSchema();
            $validated = $request->validate([...$this->protectedFields(),
                'search' => ['sometimes', 'nullable', 'string', 'max:100'],
                'product' => ['sometimes', 'nullable', 'integer', 'min:1'],
                'condition' => ['sometimes', 'nullable', Rule::in(['active', 'expired', 'on_hold', 'empty'])],
                'include_empty' => ['sometimes', 'boolean'],
                'page' => ['sometimes', 'integer', 'min:1', 'max:2147483647'], 'per_page' => ['prohibited'],
            ]);
            $inventories = StoreInventory::forStore($context['store']->store_id)
                ->whereHas('product', fn ($q) => $q->forStore($context['store']->store_id));
            // Supports post-migration historical stock without changing its physical count or dates.
            foreach ((clone $inventories)->where('batches_initialized', false)->orderBy('store_inventory_id')->lockForUpdate()->get() as $item) {
                app(\App\Services\BatchStock::class)->initialize($item);
            }
            $products = (clone $inventories)->with('product')->orderBy('product_id')->get()
                ->map(fn ($item) => $item->product->only(['product_id', 'product_name', 'sku']))->values();
            if (!empty($validated['product'])) abort_unless($products->contains('product_id', (int) $validated['product']), 404);
            $query = InventoryBatch::whereIn('store_inventory_id', (clone $inventories)->select('store_inventory_id'));
            if (!$request->boolean('include_empty')) $query->where('remaining_quantity', '>', 0);
            if (!empty($validated['product'])) $query->whereHas('inventory', fn ($q) => $q->where('product_id', $validated['product']));
            $today = now('Asia/Manila')->format('Y-m-d');
            switch ($validated['condition'] ?? '') {
                case 'active': $query->where('status', 'active')->where(fn ($q) => $q->whereNull('expiry_date')->orWhere('expiry_date', '>=', $today)); break;
                case 'expired': $query->where('status', 'active')->where('expiry_date', '<', $today); break;
                case 'on_hold': $query->where('status', 'on_hold'); break;
                case 'empty': $query->where('remaining_quantity', 0); break;
            }
            $search = trim($validated['search'] ?? '');
            if ($search !== '') {
                // Matches the exact stable displayNumber contract, including readable saved B-numbers.
                $number = DB::getDriverName() === 'sqlite'
                    ? "CASE WHEN reference GLOB 'B-[0-9]*' AND substr(reference, 3) NOT GLOB '*[^0-9]*' THEN reference ELSE 'B-' || printf('%06d', inventory_batches.id) END"
                    : "CASE WHEN reference REGEXP '^B-[0-9]+$' THEN reference ELSE CONCAT('B-', LPAD(inventory_batches.id, GREATEST(6, CHAR_LENGTH(inventory_batches.id)), '0')) END";
                $query->where(fn ($q) => $q->whereRaw($number.' LIKE ?', ['%'.$search.'%'])
                    ->orWhereHas('inventory.product', fn ($p) => $p->where('product_name', 'like', '%'.$search.'%')->orWhere('sku', 'like', '%'.$search.'%')));
            }
            $total = (clone $query)->count();
            $last = max(1, (int) ceil($total / 10));
            $page = min((int) ($validated['page'] ?? 1), $last);
            $rows = $query->with('inventory.product')->orderBy('store_inventory_id')->orderBy('id')
                ->offset(($page - 1) * 10)->limit(10)->get()->map(function ($batch) {
                    $inventory = $batch->inventory;
                    $pending = StockAdjustment::where('pending_batch_id', $batch->id)->first();
                    return [...$batch->publicData(), ...$inventory->product->only(['product_id', 'product_name', 'sku', 'size', 'selling_unit']),
                        'store_inventory_id' => $inventory->store_inventory_id, 'stock_version' => $inventory->stock_version,
                        'allocated_quantity' => $this->allocated($batch->id), 'pending_adjustment_id' => $pending?->id,
                        'stock_condition' => $batch->status === 'active' && !$batch->eligible() ? 'expired' : $batch->status];
                });
            return response()->json(['store' => $context['store']->only(['store_id', 'store_name', 'address', 'status']),
                'products' => $products, 'batches' => $rows,
                'pagination' => ['current_page' => $page, 'last_page' => $last, 'per_page' => 10, 'total' => $total,
                    'from' => $total ? ($page - 1) * 10 + 1 : null, 'to' => $total ? min($page * 10, $total) : null],
            ])->header('Cache-Control', 'no-store, private');
        }, 3);
    }

    public function store(Request $request, int $item): JsonResponse
    {
        return DB::transaction(function () use ($request, $item) {
            $context = $this->access->resolve($request->user(), ['inventory_worker']);
            $this->requireStockSchema();
            $inventory = $this->access->inventory($context['store'], $item);
            $validated = $request->validate([...$this->protectedFields(),
                'inventory_batch_id' => ['required', 'integer', 'min:1'],
                'operation_id' => ['required', 'uuid'],
                'requested_remaining_quantity' => ['required', 'integer', 'min:0', 'max:2147483647'],
                'requested_hard_stock_qty' => ['prohibited'],
                'expected_stock_version' => ['required', 'integer', 'min:0'],
                'reason' => ['required', 'string', 'max:1000'],
            ]);
            $batch = $inventory->batches()->whereKey($validated['inventory_batch_id'])->lockForUpdate()->firstOrFail();
            $actual = (int) $validated['requested_remaining_quantity'];
            $reason = trim($validated['reason']);
            if ($reason === '') throw ValidationException::withMessages(['reason' => 'Enter a reason for this batch correction.']);
            $hash = hash('sha256', json_encode([$context['user']->id, $inventory->store_inventory_id, $batch->id,
                $actual, (int) $validated['expected_stock_version'], $reason]));
            $operation = strtolower($validated['operation_id']);
            $existing = StockAdjustment::where('store_id', $inventory->store_id)
                ->where('operation_id', $operation)->lockForUpdate()->first();
            if ($existing) {
                abort_unless(hash_equals($existing->request_hash, $hash), 409, 'This operation was already used for a different correction.');
                return response()->json(['message' => 'This batch correction was already submitted. Stock is unchanged.',
                    'adjustment' => $this->adjustmentData($existing)]);
            }
            // A locking/current read is essential under InnoDB REPEATABLE READ: an
            // earlier role lookup may have established a snapshot before the store lock.
            abort_if(StockAdjustment::where('pending_batch_id', $batch->id)->lockForUpdate()->first() !== null, 409,
                'Correction pending for this batch. Review the existing request before submitting another.');
            abort_if((int) $validated['expected_stock_version'] !== $inventory->stock_version, 409,
                'Stock changed. Refresh the batch table and submit a fresh count.');
            if ($actual === $batch->remaining_quantity) throw ValidationException::withMessages([
                'requested_remaining_quantity' => 'The actual remaining count must differ from the recorded count.',
            ]);
            $total = $inventory->hard_stock_qty + $actual - $batch->remaining_quantity;
            if ($total < 0 || $total > 2147483647) throw ValidationException::withMessages([
                'requested_remaining_quantity' => 'The corrected product total is outside the supported range.',
            ]);
            $allocations = DB::table('order_batch_allocations')->where('inventory_batch_id', $batch->id)
                ->where('status', 'reserved')->orderBy('id')->lockForUpdate()->get();
            $adjustment = StockAdjustment::create([
                'store_id' => $inventory->store_id, 'store_inventory_id' => $inventory->store_inventory_id,
                'inventory_batch_id' => $batch->id, 'pending_batch_id' => $batch->id,
                'operation_id' => $operation, 'request_hash' => $hash,
                'requested_by_user_id' => $context['user']->id,
                'observed_hard_stock_qty' => $inventory->hard_stock_qty,
                'observed_soft_stock_qty' => $inventory->soft_stock_qty,
                'observed_stock_version' => $inventory->stock_version,
                'requested_hard_stock_qty' => $total,
                'observed_remaining_quantity' => $batch->remaining_quantity,
                'requested_remaining_quantity' => $actual,
                'observed_allocated_quantity' => (int) $allocations->sum('quantity'),
                'batch_snapshot' => $this->batchSnapshot($batch), 'reason' => $reason, 'status' => 'pending',
            ]);
            $adjustment->setRelation('inventory', $inventory);
            $adjustment->setRelation('batch', $batch);
            return response()->json([
                'message' => 'Batch count submitted for Supervisor approval. Stock is unchanged.',
                'adjustment' => $this->adjustmentData($adjustment),
            ], 201);
        }, 3);
    }

    public function decide(Request $request, int $adjustment): JsonResponse
    {
        return DB::transaction(function () use ($request, $adjustment) {
            $context = $this->access->resolve($request->user(), ['supervisor']);
            $this->requireStockSchema();
            // Store lock serializes all stock writers. Use the same inventory-before-batch order.
            $lookup = StockAdjustment::where('store_id', $context['store']->store_id)->findOrFail($adjustment);
            $inventory = $this->access->inventory($context['store'], $lookup->store_inventory_id);
            $batch = $lookup->inventory_batch_id
                ? $inventory->batches()->whereKey($lookup->inventory_batch_id)->lockForUpdate()->firstOrFail() : null;
            $record = StockAdjustment::whereKey($adjustment)->lockForUpdate()->firstOrFail();
            $record->setRelation('inventory', $inventory);
            $record->setRelation('batch', $batch);
            $validated = $request->validate([...$this->protectedFields(),
                'decision' => ['required', Rule::in(['approved', 'rejected'])],
                'decision_note' => ['required_if:decision,rejected', 'nullable', 'string', 'max:1000'],
                ...array_fill_keys(['requested_hard_stock_qty', 'requested_remaining_quantity', 'inventory_batch_id',
                    'operation_id', 'expected_stock_version', 'reason'], ['prohibited']),
            ]);
            abort_if($record->status !== 'pending', 409, 'This request has already been decided.');
            if ($validated['decision'] === 'rejected' && trim($validated['decision_note'] ?? '') === '') {
                throw ValidationException::withMessages(['decision_note' => 'Enter a reason for rejection.']);
            }
            if ($validated['decision'] === 'approved') {
                abort_if($record->requested_by_user_id === $context['user']->id, 403, 'You cannot approve your own stock correction.');
                abort_unless($batch, 409, 'Historical whole-product request: reject it and ask for a batch-specific count.');
                abort_if($this->isStale($record), 409, 'Stock changed after this request. Reject it and request a fresh batch count.');
                app(\App\Services\BatchStock::class)->correctBatch($inventory, $batch, $record->requested_remaining_quantity, $record->id);
            }
            $record->status = $validated['decision'];
            $record->pending_batch_id = null;
            $record->decided_by_user_id = $context['user']->id;
            $record->decision_note = $validated['decision_note'] ?? null;
            $record->decided_at = now();
            $record->save();
            return response()->json(['message' => 'Stock correction '.$record->status.'.',
                'adjustment' => $this->adjustmentData($record)]);
        }, 3);
    }

    private function batchSnapshot(InventoryBatch $batch): array
    {
        return [...$batch->only(['reference', 'quantity_received', 'remaining_quantity', 'status', 'stock_receipt_id']),
            'batch_no' => InventoryBatch::displayNumber($batch->id, $batch->reference),
            'received_date' => $batch->received_date?->format('Y-m-d'), 'expiry_date' => $batch->expiry_date?->format('Y-m-d')];
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

            return response()->json(['message' => 'Product quantity limit and Re-order Level saved.']);
        }, 3);
    }

    private function isStale(StockAdjustment $adjustment): bool
    {
        // Version detects a count that changed and later returned to the same number.
        $inventory = $adjustment->inventory;
        return $adjustment->observed_stock_version !== $inventory->stock_version
            || $adjustment->observed_hard_stock_qty !== $inventory->hard_stock_qty
            || $adjustment->observed_soft_stock_qty !== $inventory->soft_stock_qty
            || ($adjustment->inventory_batch_id && (!$adjustment->batch
                || $this->batchChanged($adjustment)
                || $adjustment->observed_allocated_quantity !== $this->allocated($adjustment->inventory_batch_id)));
    }

    private function batchChanged(StockAdjustment $adjustment): bool
    {
        // Native MySQL JSON may reorder object keys without changing the evidence.
        $observed = $adjustment->batch_snapshot ?? [];
        $current = $this->batchSnapshot($adjustment->batch);
        ksort($observed);
        ksort($current);
        return $observed !== $current;
    }

    private function adjustmentData(StockAdjustment $adjustment): array
    {
        $batch = $adjustment->batch;
        $allocated = $batch ? $this->allocated($batch->id) : null;
        $conflict = $batch && ($adjustment->requested_remaining_quantity < $allocated
            || $adjustment->inventory->hard_stock_qty + $adjustment->requested_remaining_quantity - $batch->remaining_quantity < $adjustment->inventory->soft_stock_qty);
        return [
            'inventory_batch_id' => $adjustment->inventory_batch_id,
            'is_legacy' => !$adjustment->inventory_batch_id,
            'batch_no' => $adjustment->batch_snapshot['batch_no'] ?? null,
            'received_date' => $adjustment->batch_snapshot['received_date'] ?? null,
            'expiry_date' => $adjustment->batch_snapshot['expiry_date'] ?? null,
            'selling_unit' => $adjustment->inventory->product->selling_unit,
            'observed_remaining_quantity' => $adjustment->observed_remaining_quantity,
            'requested_remaining_quantity' => $adjustment->requested_remaining_quantity,
            'quantity_change' => $batch ? $adjustment->requested_remaining_quantity - $adjustment->observed_remaining_quantity : null,
            'observed_allocated_quantity' => $adjustment->observed_allocated_quantity,
            'current_remaining_quantity' => $batch?->remaining_quantity,
            'current_allocated_quantity' => $allocated,
            'stock_condition' => $batch ? ($batch->status === 'active' && !$batch->eligible() ? 'expired' : $batch->status) : null,
            'reconciliation_required' => (bool) $conflict,
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

    private function allocated(int $batchId): int
    {
        return (int) DB::table('order_batch_allocations')->where('inventory_batch_id', $batchId)->where('status', 'reserved')->sum('quantity');
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
        if (! Schema::hasTable('stock_adjustments') || ! Schema::hasTable('inventory_policy_logs') || ! Schema::hasColumn('stock_adjustments', 'inventory_batch_id')) {
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
            'pending_batch_id', 'request_hash', 'batch_snapshot', 'observed_remaining_quantity', 'observed_allocated_quantity',
            'quantity_received', 'received_date', 'expiry_date', 'reference', 'sku',
        ], ['prohibited']);
    }
}
