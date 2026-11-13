<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\StockAlerts;
use App\Services\StoreStaffAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class StockReceivingController extends Controller
{
    private const COLUMNS = ['sku', 'quantity', 'received_date', 'expiration_date', 'batch_reference'];

    private function context(Request $request, StoreStaffAccess $access, array $roles): array
    {
        $context = $access->resolve($request->user(), $roles);
        abort_unless(Schema::hasTable('stock_receiving_requests'), 503, 'Receiving and batch tracking await reviewed database setup. Existing stock is preserved.');
        return $context;
    }

    public function index(Request $request, StoreStaffAccess $access)
    {
        return DB::transaction(function () use ($request, $access) {
            $context = $this->context($request, $access, ['inventory_worker', 'supervisor']);
            $storeId = $context['store']->store_id;
            return response()->json(['store' => $context['store']->only(['store_id', 'store_name']),
                'requests' => DB::table('stock_receiving_requests')->where('store_id', $storeId)->orderByDesc('id')->get(),
                'batches' => DB::table('stock_batches')->where('store_id', $storeId)->orderByDesc('id')->get()]);
        });
    }

    public function store(Request $request, int $item, StoreStaffAccess $access)
    {
        if (is_string($request->batch_reference)) $request->merge(['batch_reference' => mb_strtoupper(trim($request->batch_reference))]);
        return DB::transaction(function () use ($request, $item, $access) {
            $context = $this->context($request, $access, ['inventory_worker']);
            $inventory = $access->inventory($context['store'], $item);
            $data = $request->validate([
                'kind' => ['required', Rule::in(['receive', 'dispose'])], 'quantity' => ['required', 'integer', 'min:1', 'max:1000000'],
                'received_date' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.now('Asia/Manila')->toDateString()],
                'expiration_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:received_date'],
                'batch_reference' => ['required', 'string', 'max:100', 'regex:/^[\pL\pN][\pL\pN ._\/-]*$/u'],
                'batch_id' => ['nullable', 'integer', 'required_if:kind,dispose'], 'description' => ['required', 'string', 'max:1000'],
                'store_id' => ['prohibited'], 'status' => ['prohibited'], 'requested_by_user_id' => ['prohibited'], 'hard_stock_qty' => ['prohibited'],
            ]);
            $data['expiration_date'] ??= null;
            if ($data['kind'] === 'dispose') {
                $batch = DB::table('stock_batches')->where('store_id', $context['store']->store_id)->where('store_inventory_id', $item)->where('id', $data['batch_id'])->first();
                abort_unless($batch && $data['quantity'] <= $batch->remaining_qty, 422, 'Select a batch in your store with enough remaining physical units.');
            } else { $data['batch_id'] = null; }
            $this->ensureUnique($context['store']->store_id, $item, $data['batch_reference'], $data['kind']);
            $id = $this->insert($context, $item, $data);
            return response()->json(['message' => 'Request submitted for Supervisor approval. Physical stock is unchanged.', 'id' => $id], 201);
        }, 3);
    }

    public function decide(Request $request, int $receiving, StoreStaffAccess $access)
    {
        return DB::transaction(function () use ($request, $receiving, $access) {
            $context = $this->context($request, $access, ['supervisor']);
            $input = $request->validate(['decision' => ['required', Rule::in(['approved', 'rejected'])], 'decision_note' => ['required', 'string', 'max:1000']]);
            $record = DB::table('stock_receiving_requests')->where('store_id', $context['store']->store_id)->where('id', $receiving)->lockForUpdate()->first();
            abort_unless($record, 404);
            abort_unless($record->status === 'pending', 409, 'This receiving request was already decided. Refresh the history.');
            abort_if($record->requested_by_user_id === $context['user']->id, 403, 'You cannot approve your own stock request.');
            $inventory = $access->inventory($context['store'], $record->store_inventory_id);
            $before = $inventory->hard_stock_qty;
            $batchId = $record->batch_id;
            if ($input['decision'] === 'approved') {
                if ($record->kind === 'receive') {
                    abort_if($before + $record->quantity > 2147483647, 422, 'The resulting physical count exceeds the supported range.');
                    $expired = $record->expiration_date && $record->expiration_date < now('Asia/Manila')->toDateString();
                    $batchId = DB::table('stock_batches')->insertGetId(['store_id' => $record->store_id, 'store_inventory_id' => $record->store_inventory_id,
                        'batch_reference' => $record->batch_reference, 'received_date' => $record->received_date, 'expiration_date' => $record->expiration_date,
                        'quantity_received' => $record->quantity, 'remaining_qty' => $record->quantity, 'status' => $expired ? 'quarantined' : 'available',
                        'received_by_user_id' => $record->requested_by_user_id, 'created_at' => now(), 'updated_at' => now()]);
                    $inventory->hard_stock_qty += $record->quantity;
                } else {
                    $batch = DB::table('stock_batches')->where('store_id', $record->store_id)->where('store_inventory_id', $record->store_inventory_id)->where('id', $batchId)->lockForUpdate()->first();
                    abort_unless($batch && $batch->remaining_qty >= $record->quantity, 409, 'Batch quantities changed. Reject this request and reconcile the physical count.');
                    abort_if($before - $record->quantity < $inventory->soft_stock_qty, 409, 'Disposal cannot reduce physical stock below reserved units. Reconcile affected orders first.');
                    DB::table('stock_batches')->where('id', $batchId)->update(['remaining_qty' => $batch->remaining_qty - $record->quantity, 'updated_at' => now()]);
                    $inventory->hard_stock_qty -= $record->quantity;
                }
                DB::table('stock_batch_events')->insert(['batch_id' => $batchId, 'actor_user_id' => $context['user']->id,
                    'event' => $record->kind, 'quantity' => $record->quantity, 'description' => $record->description.' | Approval: '.$input['decision_note'], 'created_at' => now()]);
                $inventory->stock_version++;
                $inventory->save();
            }
            DB::table('stock_receiving_requests')->where('id', $record->id)->update([
                'status' => $input['decision'], 'decided_by_user_id' => $context['user']->id, 'decision_note' => $input['decision_note'],
                'batch_id' => $batchId, 'hard_stock_before' => $before, 'hard_stock_after' => $inventory->hard_stock_qty,
                'decided_at' => now(), 'updated_at' => now(),
            ]);
            return response()->json(['message' => 'Stock request '.$input['decision'].'.']);
        }, 3);
    }

    public function quarantine(Request $request, int $batch, StoreStaffAccess $access)
    {
        return DB::transaction(function () use ($request, $batch, $access) {
            $context = $this->context($request, $access, ['supervisor']);
            $input = $request->validate(['description' => ['required', 'string', 'max:1000']]);
            $record = DB::table('stock_batches')->where('store_id', $context['store']->store_id)->where('id', $batch)->first();
            abort_unless($record, 404);
            $inventory = $access->inventory($context['store'], $record->store_inventory_id);
            $record = DB::table('stock_batches')->where('id', $batch)->lockForUpdate()->first();
            abort_if($record->status === 'quarantined', 409, 'This batch is already quarantined.');
            DB::table('stock_batches')->where('id', $batch)->update(['status' => 'quarantined', 'updated_at' => now()]);
            DB::table('stock_batch_events')->insert(['batch_id' => $batch, 'actor_user_id' => $context['user']->id, 'event' => 'quarantine',
                'quantity' => $record->remaining_qty, 'description' => $input['description'], 'created_at' => now()]);
            $inventory->stock_version++;
            $inventory->save();
            return response()->json(['message' => 'Batch quarantined. Physical stock is unchanged; affected units are not sellable.']);
        }, 3);
    }

    public function template(Request $request, StoreStaffAccess $access)
    {
        DB::transaction(fn () => $this->context($request, $access, ['inventory_worker']));
        return response(implode(',', self::COLUMNS)."\r\n", 200, ['Content-Type' => 'text/csv; charset=UTF-8', 'Content-Disposition' => 'attachment; filename="stock-receiving-template.csv"']);
    }

    public function preview(Request $request, StoreStaffAccess $access)
    {
        $request->validate(['file' => ['required', 'file', 'mimes:csv,txt', 'max:1024']]);
        return DB::transaction(function () use ($request, $access) {
            $context = $this->context($request, $access, ['inventory_worker']);
            $stream = fopen($request->file('file')->getRealPath(), 'r');
            try {
                $header = fgetcsv($stream, 0, ',', '"', '');
                if ($header) $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]);
                abort_unless($header === self::COLUMNS, 422, 'Use the provided CSV template and keep its five column headers unchanged.');
                $rows = []; $errors = []; $seen = []; $line = 1; $recordCount = 0;
                $source = file_get_contents($request->file('file')->getRealPath());
                $nextLine = 2;
                $offset = ftell($stream);
                while (($values = fgetcsv($stream, 0, ',', '"', '')) !== false) {
                    $line = $nextLine;
                    $endOffset = ftell($stream);
                    $nextLine += max(1, substr_count(substr($source, $offset, $endOffset - $offset), "\n"));
                    $offset = $endOffset;
                    $recordCount++; abort_if($recordCount > 500, 422, 'Import up to 500 data rows at a time.');
                    if ($values === [null]) continue;
                    if (! mb_check_encoding(implode('', $values), 'UTF-8')) { $errors[] = ['line' => $line, 'message' => 'Save the file as UTF-8 CSV and try again.']; continue; }
                    if (count($values) !== count(self::COLUMNS)) { $errors[] = ['line' => $line, 'message' => 'Expected five columns.']; continue; }
                    $row = array_combine(self::COLUMNS, array_map('trim', $values));
                    $row['batch_reference'] = mb_strtoupper($row['batch_reference']);
                    $validator = validator($row, [
                        'sku' => ['required', 'string', 'max:64'], 'quantity' => ['required', 'integer', 'min:1', 'max:1000000'],
                        'received_date' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.now('Asia/Manila')->toDateString()],
                        'expiration_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:received_date'],
                        'batch_reference' => ['required', 'string', 'max:100', 'regex:/^[\pL\pN][\pL\pN ._\/-]*$/u'],
                    ]);
                    $inventory = DB::table('store_inventory')->join('products', 'products.product_id', '=', 'store_inventory.product_id')
                        ->where('store_inventory.store_id', $context['store']->store_id)->where('products.store_id', $context['store']->store_id)
                        ->where('products.sku', mb_strtoupper($row['sku']))->first(['store_inventory.store_inventory_id']);
                    $duplicateKey = mb_strtoupper($row['sku']).'|'.mb_strtolower($row['batch_reference']);
                    if ($validator->fails()) { $errors[] = ['line' => $line, 'message' => $validator->errors()->first()]; continue; }
                    if (! $inventory) { $errors[] = ['line' => $line, 'message' => 'SKU is not in your assigned store.']; continue; }
                    if (isset($seen[$duplicateKey]) || $this->duplicate($context['store']->store_id, $inventory->store_inventory_id, $row['batch_reference'], 'receive')) {
                        $errors[] = ['line' => $line, 'message' => 'Duplicate SKU and batch reference.']; continue;
                    }
                    $seen[$duplicateKey] = true;
                    $rows[] = $row + ['line' => $line, 'store_inventory_id' => $inventory->store_inventory_id];
                }
            } finally { fclose($stream); }
            $token = $rows ? Crypt::encryptString(json_encode(['user_id' => $context['user']->id, 'store_id' => $context['store']->store_id,
                'expires_at' => now()->addMinutes(15)->timestamp, 'rows' => $rows])) : null;
            return response()->json(['rows' => $rows, 'errors' => $errors, 'accepted' => count($rows), 'rejected' => count($errors),
                'preview_token' => $token, 'message' => 'Preview only. Confirm valid rows to submit requests for Supervisor approval. No stock has changed.']);
        });
    }

    public function import(Request $request, StoreStaffAccess $access)
    {
        $request->validate(['preview_token' => ['required', 'string', 'max:500000']]);
        try { $preview = json_decode(Crypt::decryptString($request->preview_token), true, 512, JSON_THROW_ON_ERROR); }
        catch (\Throwable) { abort(422, 'This preview is invalid. Select your CSV and preview it again.'); }
        return DB::transaction(function () use ($request, $access, $preview) {
            $context = $this->context($request, $access, ['inventory_worker']);
            abort_unless(($preview['user_id'] ?? null) === $context['user']->id && ($preview['store_id'] ?? null) === $context['store']->store_id
                && ($preview['expires_at'] ?? 0) > now()->timestamp, 409, 'This preview expired or your store assignment changed. Preview the file again.');
            foreach ($preview['rows'] as $row) {
                $access->inventory($context['store'], $row['store_inventory_id']);
                abort_if($this->duplicate($context['store']->store_id, $row['store_inventory_id'], $row['batch_reference'], 'receive'), 409,
                    'A row was already submitted. Nothing was imported; preview the file again.');
                $this->insert($context, $row['store_inventory_id'], ['kind' => 'receive', 'batch_reference' => $row['batch_reference'],
                    'quantity' => (int) $row['quantity'], 'received_date' => $row['received_date'], 'expiration_date' => $row['expiration_date'] ?: null,
                    'description' => 'CSV receiving import, source line '.$row['line']]);
            }
            return response()->json(['message' => 'Valid rows submitted for Supervisor approval. Stock is unchanged.', 'submitted' => count($preview['rows'])], 201);
        }, 3);
    }

    private function duplicate(int $storeId, int $item, string $reference, string $kind): bool
    {
        return DB::table('stock_receiving_requests')->where('store_id', $storeId)->where('store_inventory_id', $item)->where('batch_reference', $reference)->where('kind', $kind)->lockForUpdate()->first() !== null
            || ($kind === 'receive' && DB::table('stock_batches')->where('store_id', $storeId)->where('store_inventory_id', $item)->where('batch_reference', $reference)->lockForUpdate()->first() !== null);
    }

    private function ensureUnique(int $storeId, int $item, string $reference, string $kind): void
    {
        if ($this->duplicate($storeId, $item, $reference, $kind)) throw ValidationException::withMessages(['batch_reference' => 'This batch reference was already submitted for this product.']);
    }

    private function insert(array $context, int $item, array $data): int
    {
        return DB::table('stock_receiving_requests')->insertGetId(array_intersect_key($data, array_flip(['kind', 'quantity', 'received_date', 'expiration_date', 'batch_reference', 'batch_id', 'description']))
            + ['store_id' => $context['store']->store_id, 'store_inventory_id' => $item, 'requested_by_user_id' => $context['user']->id,
                'status' => 'pending', 'created_at' => now(), 'updated_at' => now()]);
    }
}
