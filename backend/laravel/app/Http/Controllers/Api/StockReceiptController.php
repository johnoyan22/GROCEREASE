<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StockReceipt;
use App\Models\StoreInventory;
use App\Services\BatchStock;
use App\Services\StoreStaffAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class StockReceiptController extends Controller
{
    public function index(Request $request, StoreStaffAccess $access)
    {
        return DB::transaction(function () use ($request, $access) {
            $context = $access->resolve($request->user(), ['inventory_worker', 'supervisor']);
            $request->validate($this->protectedFields());
            $rows = StockReceipt::where('store_id', $context['store']->store_id)->orderByDesc('id')->get()->map(fn ($r) => $this->data($r));
            return response()->json(['store' => $context['store']->only(['store_id', 'store_name']), 'receipts' => $rows]);
        }, 3);
    }

    public function store(Request $request, int $item, StoreStaffAccess $access)
    {
        return DB::transaction(function () use ($request, $item, $access) {
            $context = $access->resolve($request->user(), ['inventory_worker']);
            $inventory = $access->inventory($context['store'], $item);
            $validated = $request->validate([...$this->protectedFields(),
                'operation_id' => ['required', 'uuid'], 'quantity' => ['required', 'integer', 'min:1', 'max:2147483647'],
                'received_date' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.now('Asia/Manila')->format('Y-m-d')],
                'expiry_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:received_date'],
                'description' => ['required', 'string', 'max:1000', 'regex:/\S/u'],
            ]);
            $details = ['store_inventory_id' => $inventory->store_inventory_id, 'quantity' => (int) $validated['quantity'],
                'received_date' => $validated['received_date'], 'expiry_date' => $validated['expiry_date'] ?? null,
                'description' => trim($validated['description'])];
            $hash = hash('sha256', json_encode($details));
            $key = strtolower($validated['operation_id']);
            $existing = StockReceipt::where('store_id', $inventory->store_id)->where('operation_id', $key)->lockForUpdate()->first();
            if ($existing) {
                abort_unless($existing->requested_by_user_id === $context['user']->id && $existing->request_hash === $hash, 409, 'This submission identity was already used for another receipt.');
                return response()->json(['message' => 'This stock addition was already submitted.', 'receipt' => $this->data($existing)]);
            }
            $receipt = StockReceipt::create([...$details, 'store_id' => $inventory->store_id, 'operation_id' => $key,
                'request_hash' => $hash, 'requested_by_user_id' => $context['user']->id]);
            return response()->json(['message' => 'Stock addition submitted for Supervisor approval. Stock is unchanged.', 'receipt' => $this->data($receipt->refresh())], 201);
        }, 3);
    }

    public function decide(Request $request, int $receipt, StoreStaffAccess $access, BatchStock $batches)
    {
        return DB::transaction(function () use ($request, $receipt, $access, $batches) {
            $context = $access->resolve($request->user(), ['supervisor']);
            $record = StockReceipt::where('store_id', $context['store']->store_id)->whereKey($receipt)->lockForUpdate()->firstOrFail();
            $inventory = $access->inventory($context['store'], $record->store_inventory_id);
            $validated = $request->validate([...$this->protectedFields(),
                'decision' => ['required', Rule::in(['approved', 'rejected'])],
                'decision_note' => ['required_if:decision,rejected', 'nullable', 'string', 'max:1000', 'regex:/\S/u'],
                'quantity' => ['prohibited'], 'received_date' => ['prohibited'], 'expiry_date' => ['prohibited'], 'description' => ['prohibited'],
            ]);
            abort_unless($record->status === 'pending', 409, 'This stock addition has already been decided.');
            if ($validated['decision'] === 'approved') {
                abort_if($record->requested_by_user_id === $context['user']->id, 403, 'You cannot approve your own stock addition.');
                abort_if($inventory->hard_stock_qty > 2147483647 - $record->quantity, 422, 'The resulting stock exceeds the supported quantity.');
                $batches->initialize($inventory);
                $batches->create($inventory, $record->quantity, [
                    'stock_receipt_id' => $record->id, 'received_date' => $record->received_date, 'expiry_date' => $record->expiry_date,
                    'description' => $record->description, 'created_by_user_id' => $context['user']->id,
                ]);
                $inventory->hard_stock_qty += $record->quantity;
                $inventory->stock_version++;
                $inventory->save();
            }
            $record->status = $validated['decision'];
            $record->decided_by_user_id = $context['user']->id;
            $record->decision_note = $validated['decision_note'] ?? null;
            $record->decided_at = now();
            $record->save();
            return response()->json(['message' => 'Stock addition '.$record->status.'.', 'receipt' => $this->data($record)]);
        }, 3);
    }

    private function data(StockReceipt $record): array
    {
        $product = StoreInventory::forStore($record->store_id)->findOrFail($record->store_inventory_id)->product;
        return [...$record->only(['id', 'store_id', 'store_inventory_id', 'operation_id', 'quantity', 'description', 'status',
            'requested_by_user_id', 'decided_by_user_id', 'decision_note', 'decided_at', 'created_at']),
            'received_date' => $record->received_date->format('Y-m-d'), 'expiry_date' => $record->expiry_date?->format('Y-m-d'),
            ...$product->only(['product_name', 'sku', 'size', 'selling_unit'])];
    }

    private function protectedFields(): array
    {
        abort_unless(Schema::hasTable('stock_receipts'), 503, 'Stock receiving is awaiting database setup. Please contact your administrator.');
        return array_fill_keys(['store_id', 'store_inventory_id', 'product_id', 'user_id', 'role', 'status', 'requested_by_user_id',
            'decided_by_user_id', 'decided_at', 'hard_stock_qty', 'soft_stock_qty', 'batch_reference', 'batch_number', 'reason',
            'units_per_carton', 'carton_quantity'], ['prohibited']);
    }
}
