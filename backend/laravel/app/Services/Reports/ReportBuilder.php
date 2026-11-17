<?php

namespace App\Services\Reports;

use App\Models\InventoryBatch;
use App\Models\Order;
use App\Models\Store;
use App\Models\StoreInventory;
use App\Services\LowStockMonitor;
use App\Services\PaymentEvidence;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ReportBuilder
{
    private array $filters;
    private CarbonImmutable $now;
    private array $sections = [];
    private array $metrics = [];
    private array $notes = [];
    private int $sourceRows = 0;

    public function build(array $filters, CarbonImmutable $now): array
    {
        $this->filters = $filters; $this->now = $now;
        $this->sections = []; $this->metrics = []; $this->notes = []; $this->sourceRows = 0;
        match ($filters['type']) {
            'current_stock' => $this->stock(), 'batches' => $this->batches(),
            'stock_changes' => $this->changes(), 'availability' => $this->availability(),
            'payments' => $this->payments(), 'order_operations', 'store_operations' => $this->operations(),
            'cop' => $this->cop(),
        };
        abort_if(array_sum(array_column($this->sections, 'row_count')) > config('reports.max_report_rows'), 422,
            'This report is too large. Narrow the period, store, search or status filters. No rows were truncated.');
        return ['metrics' => $this->metrics, 'sections' => $this->sections, 'notes' => $this->notes];
    }

    private function requireTables(array $tables): void
    {
        foreach ($tables as $table) abort_unless(Schema::hasTable($table), 503, 'Report source unavailable: '.$table.'. Complete database setup before generating.');
    }

    private function scope($query, string $column = 'store_id')
    {
        return $query->when($this->filters['store_id'] !== null, fn ($q) => $q->where($column, $this->filters['store_id']));
    }

    private function period($query, string $column)
    {
        $start = CarbonImmutable::parse($this->filters['from'], 'Asia/Manila')->startOfDay()->utc();
        $end = CarbonImmutable::parse($this->filters['until'], 'Asia/Manila')->addDay()->startOfDay()->utc();
        return $query->where($column, '>=', $start)->where($column, '<', $end);
    }

    private function rows($query)
    {
        $rows = $query->limit(config('reports.max_source_rows') + 1)->get();
        $this->sourceRows += $rows->count();
        abort_if($this->sourceRows > config('reports.max_source_rows'), 422, 'Too many source records. Narrow the period or filters; the report was not truncated.');
        return $rows;
    }

    private function matches(string $text): bool
    {
        return !($this->filters['search'] ?? '') || mb_stripos($text, $this->filters['search']) !== false;
    }

    private function search($query, array $columns)
    {
        if (!($this->filters['search'] ?? '')) return $query;
        $needle = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $this->filters['search']).'%';
        return $query->where(function ($q) use ($columns, $needle) {
            foreach ($columns as $column) $q->orWhereRaw($column." LIKE ? ESCAPE '!'", [$needle]);
        });
    }

    private function metric(string $label, int $value, string $format = 'number'): void { $this->metrics[] = compact('label', 'value', 'format'); }

    private function section(string $key, string $title, string $basis, array $columns, array $rows): void
    {
        $this->sections[] = compact('key', 'title', 'basis', 'columns', 'rows') + ['row_count' => count($rows)];
    }

    private function columns(array $labels, array $money = []): array
    {
        return array_map(fn ($key, $label) => ['key' => $key, 'label' => $label, 'format' => in_array($key, $money, true) ? 'money' : 'text',
            'weight' => in_array($key, ['product', 'store', 'actor'], true) ? 2.5 : (in_array($key, ['sku', 'batch', 'requested', 'decided', 'condition', 'at'], true) ? 1.5 : 1)], array_keys($labels), array_values($labels));
    }

    private function time($value): string { return $value ? CarbonImmutable::parse($value, 'UTC')->setTimezone('Asia/Manila')->format('Y-m-d h:i A') : 'Not recorded'; }
    private function day($value): string { return CarbonImmutable::parse($value, 'UTC')->setTimezone('Asia/Manila')->format('Y-m-d'); }

    private function paymentMode(object $payment): string
    {
        if ($payment->method === 'cash_on_pickup') return 'actual';
        // Called only after PaymentEvidence::valid. paymongo_test therefore has a matching
        // trusted paid test attempt; test_provider is the existing trusted test-fixture source.
        // Other provider names never establish a real or test mode by substring guessing.
        return in_array($payment->provider, ['paymongo_test', 'test_provider'], true) ? 'test' : 'legacy';
    }

    private function stock(): void
    {
        $this->requireTables(['products', 'store_inventory', 'inventory_batches', 'order_batch_allocations']);
        $query = $this->scope(StoreInventory::with(['product', 'store'])->orderBy('store_inventory_id'));
        $query->whereHas('product', fn ($q) => $this->search($q, ['product_name', 'sku', 'size']));
        $stock = $this->rows($query);
        $rows = []; $active = $low = $out = 0;
        foreach ($stock as $item) {
            $product = $item->product;
            if (!$this->matches($product->product_name.' '.$product->sku.' '.$product->size)) continue;
            $available = $item->availableStock(); $isActive = $item->status === 'active' && $item->store->status === 'active';
            $isLow = LowStockMonitor::isLow($item, $item->store);
            $active += (int) $isActive; $low += (int) $isLow; $out += (int) ($isActive && $available === 0);
            $condition = !$isActive ? 'Inactive' : (implode('; ', array_filter([$isLow ? 'Low physical stock' : null, $available === 0 ? 'Out of available stock' : null])) ?: 'In stock');
            $rows[] = ['product' => $product->product_name, 'sku' => $product->sku, 'size' => $product->size, 'unit' => $product->selling_unit ?? 'Not recorded',
                'physical' => $item->hard_stock_qty, 'reserved' => $item->soft_stock_qty, 'available' => $available, 'reorder' => $item->low_stock_threshold ?? 'Unset', 'condition' => $condition];
        }
        $expiredQuery = $this->scope(DB::table('inventory_batches as b')->join('store_inventory as i', 'i.store_inventory_id', '=', 'b.store_inventory_id')
            ->join('products as p', 'p.product_id', '=', 'i.product_id')->where('b.remaining_quantity', '>', 0)->where('b.expiry_date', '<', $this->now->format('Y-m-d')), 'i.store_id')
            ->select('p.product_name', 'p.sku', 'p.size');
        $expired = $this->rows($this->search($expiredQuery, ['p.product_name', 'p.sku', 'p.size']));
        $expiredCount = $expired->filter(fn ($row) => $this->matches($row->product_name.' '.$row->sku.' '.$row->size))->count();
        $this->metric('Active products', $active); $this->metric('Low-stock products', $low); $this->metric('Out-of-stock products (available = 0)', $out); $this->metric('Recorded nondepleted expired batches', $expiredCount);
        $this->section('stock', 'Current stock by product', 'CURRENT snapshot. Physical <= configured Re-order Level is low; null is unset. Available quantity uses the existing reservation and batch rules. Quantities are never added across selling units.',
            $this->columns(['product' => 'Product', 'sku' => 'SKU', 'size' => 'Size', 'unit' => 'Selling unit', 'physical' => 'Physical', 'reserved' => 'Reserved', 'available' => 'Available', 'reorder' => 'Re-order Level', 'condition' => 'Condition']), $rows);
    }

    private function batches(): void
    {
        $this->requireTables(['inventory_batches', 'products', 'store_inventory']);
        $rows = []; $today = $this->now->format('Y-m-d'); $horizon = $this->now->addDays(30)->format('Y-m-d');
        $query = $this->scope(InventoryBatch::with('inventory.product')->join('store_inventory as i', 'i.store_inventory_id', '=', 'inventory_batches.store_inventory_id'), 'i.store_id')->select('inventory_batches.*')->orderBy('inventory_batches.id');
        $status = $this->filters['status'];
        if ($status === 'depleted') $query->where('remaining_quantity', 0);
        elseif ($status !== 'all') {
            $query->where('remaining_quantity', '>', 0);
            if ($status === 'expiring_30') $query->whereBetween('expiry_date', [$today, $horizon]);
            elseif ($status === 'expired') $query->where('inventory_batches.status', 'active')->where('expiry_date', '<', $today);
            elseif ($status === 'active') $query->where('inventory_batches.status', 'active')->where(fn ($q) => $q->whereNull('expiry_date')->orWhere('expiry_date', '>=', $today));
            else $query->where('inventory_batches.status', $status);
        }
        // Exact stable batch numbers can narrow even a large source without loading every batch.
        if (preg_match('/^B-([0-9]+)$/iD', $this->filters['search'], $match)) {
            $query->where(fn ($q) => $q->where('inventory_batches.id', (int) $match[1])->orWhereRaw('LOWER(reference) = ?', [strtolower($this->filters['search'])]));
        } elseif (($this->filters['search'] ?? '') && !str_starts_with(strtoupper($this->filters['search']), 'B-')) {
            $query->whereHas('inventory.product', fn ($q) => $this->search($q, ['product_name', 'sku']));
        }
        $batches = $this->rows($query);
        foreach ($batches as $batch) {
            $product = $batch->inventory->product; $data = $batch->publicData(); $status = $this->filters['status'];
            if (!$this->matches($product->product_name.' '.$product->sku.' '.$data['batch_no'])) continue;
            if ($status === 'expiring_30' && !($data['remaining_quantity'] > 0 && $data['expiry_date'] && $data['expiry_date'] >= $today && $data['expiry_date'] <= $horizon)) continue;
            if (!in_array($status, ['all', 'expiring_30'], true) && $status !== $data['status']) continue;
            $rows[] = ['product' => $product->product_name, 'sku' => $product->sku, 'batch' => $data['batch_no'], 'received' => $data['received_date'] ?? 'Unknown', 'expiry' => $data['expiry_date'] ?? 'Unknown',
                'received_quantity' => $data['quantity_received'], 'remaining' => $data['remaining_quantity'], 'unit' => $product->selling_unit ?? 'Not recorded', 'state' => $data['status']];
        }
        $this->metric('Matching recorded batches', count($rows));
        $this->section('batches', 'Recorded batches', 'CURRENT snapshot; received quantities are historical and remaining quantities are current. Expiring within 30 days means expiry '.$today.' through '.$horizon.' inclusive, with remaining stock. Historical unknown dates remain unknown.',
            $this->columns(['product' => 'Product', 'sku' => 'SKU', 'batch' => 'Batch', 'received' => 'Date Received', 'expiry' => 'Expiry Date', 'received_quantity' => 'Received qty', 'remaining' => 'Remaining', 'unit' => 'Unit', 'state' => 'State']), $rows);
    }

    private function changes(): void
    {
        $this->requireTables(['stock_receipts', 'stock_adjustments', 'batch_correction_logs', 'inventory_batches', 'products', 'store_inventory']);
        $events = []; $impacts = []; $counts = ['approved' => 0, 'pending' => 0, 'rejected' => 0];
        foreach (['stock_receipts' => 'Addition', 'stock_adjustments' => 'Correction'] as $table => $kind) {
            $query = $this->scope(DB::table($table.' as r')->join('store_inventory as i', 'i.store_inventory_id', '=', 'r.store_inventory_id')->join('products as p', 'p.product_id', '=', 'i.product_id'), 'r.store_id');
            $start = CarbonImmutable::parse($this->filters['from'], 'Asia/Manila')->utc(); $end = CarbonImmutable::parse($this->filters['until'], 'Asia/Manila')->addDay()->utc();
            $query->where(function ($q) use ($start, $end) {
                $q->where(fn ($a) => $a->where('r.status', 'approved')->where('r.decided_at', '>=', $start)->where('r.decided_at', '<', $end))
                    ->orWhere(fn ($a) => $a->whereIn('r.status', ['pending', 'rejected'])->where('r.created_at', '>=', $start)->where('r.created_at', '<', $end));
            });
            if ($this->filters['status'] !== 'all') $query->where('r.status', $this->filters['status']);
            if (!str_starts_with(strtoupper($this->filters['search']), 'B-')) $this->search($query, ['p.product_name', 'p.sku']);
            $records = $this->rows($query->select('r.*', 'p.product_name', 'p.sku', 'p.selling_unit')->orderBy('r.id'));
            $logs = $kind === 'Correction' ? $this->rows(DB::table('batch_correction_logs')->whereIn('stock_adjustment_id', $records->pluck('id')))->groupBy('stock_adjustment_id') : collect();
            $receivedBatches = $kind === 'Addition' ? $this->rows(InventoryBatch::whereIn('stock_receipt_id', $records->pluck('id')))->keyBy('stock_receipt_id') : collect();
            $correctionIds = $records->pluck('inventory_batch_id')->filter()->merge($logs->flatten(1)->pluck('inventory_batch_id'))->unique();
            $correctionBatches = $kind === 'Correction' ? $this->rows(InventoryBatch::whereIn('id', $correctionIds))->keyBy('id') : collect();
            foreach ($records as $record) {
                $batch = $kind === 'Addition' ? $receivedBatches->get($record->id) : $correctionBatches->get($record->inventory_batch_id ?? null);
                $batchNo = $batch ? InventoryBatch::displayNumber($batch->id, $batch->reference) : 'Legacy / no recorded batch';
                $batchSearch = $batchNo;
                $loggedNames = [];
                if ($kind === 'Correction') foreach ($logs->get($record->id, collect()) as $log) {
                    $loggedBatch = $correctionBatches->get($log->inventory_batch_id);
                    if ($loggedBatch) { $loggedNames[] = InventoryBatch::displayNumber($loggedBatch->id, $loggedBatch->reference); $batchSearch .= ' '.end($loggedNames); }
                }
                $loggedNames = array_values(array_unique($loggedNames));
                if (count($loggedNames) > 1) $batchNo = 'Multiple recorded batches ('.count($loggedNames).')';
                elseif (!$batch && count($loggedNames) === 1) $batchNo = $loggedNames[0];
                if (!$this->matches($record->product_name.' '.$record->sku.' '.$batchSearch) || ($this->filters['status'] !== 'all' && $record->status !== $this->filters['status'])) continue;
                $counts[$record->status]++;
                $delta = null;
                if ($record->status === 'approved') {
                    if ($kind === 'Addition') $delta = (int) $record->quantity;
                    elseif ($logs->has($record->id)) $delta = (int) $logs[$record->id]->sum('quantity_change');
                    else $this->notes[] = 'An approved historical correction has no recorded delta; its quantity impact is unavailable and excluded.';
                }
                $events[] = ['request' => $kind.' #'.$record->id, 'product' => $record->product_name, 'batch' => $batchNo, 'status' => $record->status,
                    'requested' => $this->time($record->created_at), 'decided' => $this->time($record->decided_at), 'delta' => $delta ?? 'Not applied / unavailable', 'unit' => $record->selling_unit ?? 'Not recorded'];
                if ($delta !== null) {
                    $parts = $kind === 'Addition' ? [$batchNo => $delta] : [];
                    if ($kind === 'Correction') foreach ($logs[$record->id]->groupBy('inventory_batch_id') as $batchId => $entries) {
                        $recordedBatch = $correctionBatches->get($batchId);
                        $parts[$recordedBatch ? InventoryBatch::displayNumber($recordedBatch->id, $recordedBatch->reference) : 'Legacy / no recorded batch'] = (int) $entries->sum('quantity_change');
                    }
                    foreach ($parts as $partBatch => $partDelta) {
                        if (!$this->matches($record->product_name.' '.$record->sku.' '.$partBatch)) continue;
                        $key = $record->store_inventory_id.':'.$partBatch.':'.$kind;
                        $impacts[$key] ??= ['product' => $record->product_name, 'sku' => $record->sku, 'batch' => $partBatch, 'kind' => $kind, 'unit' => $record->selling_unit ?? 'Not recorded', 'delta' => 0];
                        $impacts[$key]['delta'] += $partDelta;
                    }
                }
            }
        }
        foreach ($counts as $status => $count) $this->metric(ucfirst($status).' requests', $count);
        $this->section('impacts', 'Approved quantity impacts by product / batch', 'Approval decided_at in period. Corrections use the recorded delta, never the final counted quantity as a delivery. This is request evidence, not a complete stock movement ledger.',
            $this->columns(['product' => 'Product', 'sku' => 'SKU', 'batch' => 'Batch', 'kind' => 'Kind', 'unit' => 'Unit', 'delta' => 'Approved delta']), array_values($impacts));
        $this->section('requests', 'Requests and decision dates', 'Approved: decided_at in period. Pending/rejected: created_at in period, by current status. All displayed times are Philippine time. Pending and rejected requests add no physical stock.',
            $this->columns(['request' => 'Request', 'product' => 'Product', 'batch' => 'Batch', 'status' => 'Status', 'requested' => 'Requested at', 'decided' => 'Decided at', 'delta' => 'Request delta', 'unit' => 'Unit']), $events);
    }

    private function availability(): void
    {
        $this->requireTables(['inventory_availability_logs', 'store_inventory', 'products', 'users', 'profiles']);
        $query = $this->period($this->scope(DB::table('inventory_availability_logs as a')->join('store_inventory as i', 'i.store_inventory_id', '=', 'a.store_inventory_id')->join('products as p', 'p.product_id', '=', 'i.product_id')
            ->leftJoin('profiles as actor', 'actor.user_id', '=', 'a.changed_by_user_id'), 'a.store_id'), 'a.created_at')->select('a.*', 'p.product_name', 'p.sku', 'actor.first_name', 'actor.last_name')->orderBy('a.id');
        $records = $this->rows($this->search($query, ['p.product_name', 'p.sku']));
        $rows = [];
        foreach ($records as $record) {
            if (!$this->matches($record->product_name.' '.$record->sku)) continue;
            $rows[] = ['product' => $record->product_name, 'sku' => $record->sku, 'previous' => $record->previous_status, 'new' => $record->new_status,
                'actor' => trim(($record->first_name ?? '').' '.($record->last_name ?? '')) ?: 'Staff name not recorded', 'at' => $this->time($record->created_at)];
        }
        $this->metric('Recorded availability changes', count($rows));
        $this->section('availability', 'Availability changes', 'Recorded created_at in period, Philippine time. This preserves the old Activity Log: offering availability changes only, not all staff activity or stock movement.',
            $this->columns(['product' => 'Product', 'sku' => 'SKU', 'previous' => 'Previous', 'new' => 'New', 'actor' => 'Actor', 'at' => 'Recorded at']), $rows);
    }

    private function payments(): void
    {
        $this->requireTables(['orders', 'order_payments', 'order_handovers', 'payment_checkout_attempts', 'stores']);
        $payments = $this->rows($this->period($this->scope(DB::table('order_payments as p')->join('orders as o', 'o.order_id', '=', 'p.order_id'), 'o.store_id'), 'p.confirmed_at')->select('p.*')->orderBy('p.id'));
        $orders = $this->rows(Order::whereIn('order_id', $payments->pluck('order_id')))->keyBy('order_id');
        $handovers = $this->rows(DB::table('order_handovers')->whereIn('order_id', $payments->pluck('order_id')))->keyBy('order_id');
        $groups = []; $totals = ['actual' => 0, 'test' => 0, 'legacy' => 0]; $counts = $totals; $invalid = 0; $refunds = [];
        foreach ($payments as $payment) {
            $order = $orders->get($payment->order_id);
            if (!$order || !app(PaymentEvidence::class)->valid($order, $payment)) { $invalid++; continue; }
            $mode = $this->paymentMode($payment);
            if ($this->filters['mode'] !== 'all' && $mode !== $this->filters['mode']) continue;
            abort_unless($order->currency === 'PHP', 422, 'A matching collection uses an unsupported currency. Narrow the store or period to PHP records.');
            $totals[$mode] += (int) $payment->amount_centavos; $counts[$mode]++;
            $key = $order->store_id.':'.$this->day($payment->confirmed_at).':'.$payment->method.':'.$mode;
            $groups[$key] ??= ['store' => $order->store_name, 'date' => $this->day($payment->confirmed_at), 'method' => $payment->method === 'cash_on_pickup' ? 'Cash on Pickup' : 'Digital', 'mode' => ['actual' => 'Actual', 'test' => 'TEST / SANDBOX', 'legacy' => 'Legacy / unclassified'][$mode], 'count' => 0, 'amount' => 0, 'completed' => 0, 'awaiting' => 0, 'other' => 0];
            $groups[$key]['count']++; $groups[$key]['amount'] += (int) $payment->amount_centavos;
            if ($order->status === 'completed' && $order->reservation_status === 'fulfilled' && $handovers->has($order->order_id) && (int) $handovers[$order->order_id]->order_payment_id === (int) $payment->id) $groups[$key]['completed']++;
            elseif (in_array($order->status, ['waiting', 'preparing', 'ready_for_pickup'], true) && $order->reservation_status === 'active') $groups[$key]['awaiting']++;
            else $groups[$key]['other']++;
            $refunds[$order->refund_status] = ($refunds[$order->refund_status] ?? 0) + 1;
        }
        $this->metric('Gross actual payments collected', $totals['actual'], 'money'); $this->metric('Actual verified collections', $counts['actual']);
        $this->metric('Test / sandbox collections (excluded from actual)', $totals['test'], 'money'); $this->metric('Legacy / unclassified collections (excluded from actual)', $totals['legacy'], 'money');
        $this->metric('Records excluded: invalid payment evidence (all modes)', $invalid);
        $this->section('payments', 'Verified collections by store / payment date / method / mode', 'Payment confirmed_at in selected Manila dates. Pickup counts are the CURRENT state of those paid orders. Collections are not completed sales, platform revenue, profit or settlement. Test and unproven historical modes are separate.',
            $this->columns(['store' => 'Store', 'date' => 'Payment date', 'method' => 'Method', 'mode' => 'Mode', 'count' => 'Collections', 'amount' => 'Gross PHP', 'completed' => 'Completed pickups', 'awaiting' => 'Paid awaiting pickup', 'other' => 'Other dispositions'], ['amount']), array_values($groups));
        $this->section('refunds', 'Refund status counts for these collections', 'Current order refund flags only. No completed refund-money ledger exists; no net/refund-adjusted amount is calculated and no order total is deducted.',
            $this->columns(['status' => 'Current refund status', 'count' => 'Orders']), array_map(fn ($status, $count) => compact('status', 'count'), array_keys($refunds), array_values($refunds)));
        // Separate event-date basis: genuine completed handovers occurring in the period, even if paid earlier.
        $handoverRows = $this->rows($this->period($this->scope(DB::table('order_handovers as h')->join('orders as o', 'o.order_id', '=', 'h.order_id'), 'o.store_id'), 'h.handed_over_at')->select('h.*', 'o.store_name')->orderBy('h.id'));
        $hOrders = $this->rows(Order::whereIn('order_id', $handoverRows->pluck('order_id')))->keyBy('order_id');
        $hPayments = $this->rows(DB::table('order_payments')->whereIn('id', $handoverRows->pluck('order_payment_id')))->keyBy('id');
        $hGroups = [];
        foreach ($handoverRows as $handover) {
            $order = $hOrders->get($handover->order_id); $payment = $hPayments->get($handover->order_payment_id);
            if (!$order || !$payment || (int) $payment->order_id !== $order->order_id || $order->status !== 'completed' || $order->reservation_status !== 'fulfilled' || !app(PaymentEvidence::class)->valid($order, $payment)) continue;
            $mode = $this->paymentMode($payment);
            if ($this->filters['mode'] !== 'all' && $mode !== $this->filters['mode']) continue;
            $key = $order->store_id.':'.$this->day($handover->handed_over_at).':'.$mode;
            $hGroups[$key] ??= ['store' => $order->store_name, 'date' => $this->day($handover->handed_over_at), 'mode' => $mode, 'count' => 0]; $hGroups[$key]['count']++;
        }
        $this->section('handovers', 'Completed physical handovers in period', 'Handover handed_over_at in selected Manila dates, independently of payment date. Requires completed, fulfilled order and genuine matching payment evidence. No collection money is counted again here.',
            $this->columns(['store' => 'Store', 'date' => 'Handover date', 'mode' => 'Mode', 'count' => 'Completed handovers']), array_values($hGroups));
    }

    private function operations(): void
    {
        $this->requireTables(['orders', 'order_handovers', 'order_payments', 'payment_checkout_attempts', 'stores', 'cop_strikes']);
        $rows = [];
        foreach ($this->rows($this->scope(Store::orderBy('store_id'))) as $store) {
            $orders = $this->rows($this->period(Order::where('store_id', $store->store_id), 'created_at'));
            $statuses = array_count_values($orders->pluck('status')->all());
            $completed = $this->rows($this->period(Order::where('store_id', $store->store_id)->where('status', 'completed'), 'completed_at'))->count();
            $canceled = $this->rows($this->period(Order::where('store_id', $store->store_id)->where('status', 'canceled'), 'canceled_at'))->count();
            $noShow = $this->rows($this->period(DB::table('cop_strikes')->where('store_id', $store->store_id)->whereNull('voided_at'), 'issued_at'))->count();
            $handovers = $this->rows($this->period(DB::table('order_handovers as h')->join('orders as o', 'o.order_id', '=', 'h.order_id')->where('o.store_id', $store->store_id), 'h.handed_over_at')->select('h.order_id'))->count();
            $rows[] = ['store' => $store->store_name, 'placed' => $orders->count(), 'waiting' => $statuses['waiting'] ?? 0, 'preparing' => $statuses['preparing'] ?? 0, 'ready' => $statuses['ready_for_pickup'] ?? 0,
                'completed_status' => $statuses['completed'] ?? 0, 'canceled_status' => $statuses['canceled'] ?? 0, 'completed' => $completed, 'canceled' => $canceled, 'no_show' => $noShow, 'handovers' => $handovers];
        }
        $this->metric('Orders placed in period', array_sum(array_column($rows, 'placed')));
        $this->section('placed', 'Orders placed in period: current status', 'Placed cohort uses orders.created_at. Statuses are CURRENT as of generation and are not historical closing balances.',
            $this->columns(['store' => 'Store', 'placed' => 'Placed', 'waiting' => 'Waiting', 'preparing' => 'Preparing', 'ready' => 'Ready', 'completed_status' => 'Completed now', 'canceled_status' => 'Canceled now']), array_map(fn ($r) => array_intersect_key($r, array_flip(['store', 'placed', 'waiting', 'preparing', 'ready', 'completed_status', 'canceled_status'])), $rows));
        $this->section('events', 'Order and handover events in period', 'Independent event bases: completed_at, canceled_at, issued_at for currently valid no-show strikes, and handed_over_at. These counts do not all refer to the placed cohort and must not be added together.',
            $this->columns(['store' => 'Store', 'completed' => 'Completed at', 'canceled' => 'Canceled at', 'no_show' => 'Valid no-show strikes issued', 'handovers' => 'Handed over at']), array_map(fn ($r) => array_intersect_key($r, array_flip(['store', 'completed', 'canceled', 'no_show', 'handovers'])), $rows));
        if ($this->filters['type'] === 'store_operations') {
            $this->requireTables(['store_inventory', 'products', 'inventory_batches', 'order_batch_allocations']); $inventoryRows = [];
            foreach ($this->rows($this->scope(Store::orderBy('store_id'))) as $store) {
                $items = $this->rows(StoreInventory::with('product')->where('store_id', $store->store_id));
                $active = $low = $out = 0;
                foreach ($items as $item) { $isActive = $item->status === 'active' && $store->status === 'active'; $active += (int) $isActive; $low += (int) LowStockMonitor::isLow($item, $store); $out += (int) ($isActive && $item->availableStock() === 0); }
                $inventoryRows[] = ['store' => $store->store_name, 'active' => $active, 'low' => $low, 'out' => $out];
            }
            $this->section('inventory', 'Current inventory counts by store', 'CURRENT as of generation; no historical stock balance is inferred from the selected period. Low means physical <= configured reorder level; out means no available stock. Counts are products, not mixed-unit quantities.',
                $this->columns(['store' => 'Store', 'active' => 'Active products', 'low' => 'Low-stock products', 'out' => 'Out-of-stock products']), $inventoryRows);
        }
    }

    private function cop(): void
    {
        $this->requireTables(['cop_strikes', 'stores']);
        $records = $this->rows($this->period($this->scope(DB::table('cop_strikes as c')->join('stores as s', 's.store_id', '=', 'c.store_id'), 'c.store_id'), 'c.issued_at')->select('c.*', 's.store_name')->orderBy('c.id'));
        $groups = [];
        foreach ($records as $record) { $groups[$record->store_id] ??= ['store' => $record->store_name, 'issued' => 0, 'valid' => 0, 'voided' => 0]; $groups[$record->store_id]['issued']++; $groups[$record->store_id][$record->voided_at ? 'voided' : 'valid']++; }
        $this->metric('No-show strikes issued in period', $records->count());
        $this->section('strikes', 'No-show strikes by store', 'Strike issued_at in selected Manila dates; valid/voided is CURRENT as of generation. No Shopper details are included.',
            $this->columns(['store' => 'Store', 'issued' => 'Issued', 'valid' => 'Currently valid', 'voided' => 'Currently voided']), array_values($groups));
        // Global view includes every Shopper, including manually restricted users without orders/strikes.
        // A store filter defines an all-time activity cohort; eligibility remains global.
        $cohort = DB::table('users as u')->join('roles as r', 'r.role_id', '=', 'u.role_id')->where('r.slug', 'shopper');
        if ($this->filters['store_id'] !== null) $cohort->where(function ($q) {
            $q->whereExists(fn ($x) => $x->selectRaw('1')->from('orders as o')->whereColumn('o.shopper_user_id', 'u.id')->where('o.store_id', $this->filters['store_id']))
                ->orWhereExists(fn ($x) => $x->selectRaw('1')->from('cop_strikes as cs')->whereColumn('cs.shopper_user_id', 'u.id')->where('cs.store_id', $this->filters['store_id']));
        });
        $ids = $this->rows($cohort->select('u.id'))->pluck('id')->all();
        $evaluatedRows = 0;
        $statuses = app(\App\Services\CopRestrictions::class)->statuses($ids, $this->now, maxRows: config('reports.max_source_rows') - $this->sourceRows, sourceRows: $evaluatedRows);
        $this->sourceRows += $evaluatedRows;
        $counts = ['temporary' => 0, 'permanent' => 0, 'until_restored' => 0];
        $sources = ['automatic_only' => 0, 'manual_only' => 0, 'both' => 0];
        foreach ($statuses as $status) {
            if (!$status['individual_restricted']) continue;
            $counts[$status['individual_access']]++;
            $sources[count($status['sources']) > 1 ? 'both' : ($status['sources'][0] === 'manual' ? 'manual_only' : 'automatic_only')]++;
        }
        $this->section('restrictions', 'Current COP restrictions', 'CURRENT distinct Shoppers at generation. Categories are mutually exclusive; permanent/until-restored takes priority over temporary. Global policy disable is separate. A store filter selects Shoppers with any order or strike at that store; access is evaluated globally.',
            $this->columns(['temporary' => 'Temporary', 'permanent' => 'Automatic permanent', 'until_restored' => 'Manual until restored']), [$counts]);
        $this->section('restriction_sources', 'Current restriction sources', 'CURRENT distinct Shoppers in the same activity cohort. Each appears once; manual plus automatic is its own category.',
            $this->columns(['automatic_only' => 'Automatic only', 'manual_only' => 'Manual only', 'both' => 'Manual + automatic']), [$sources]);
        $events = $this->rows($this->period(DB::table('cop_access_events')->whereIn('shopper_user_id', $ids), 'occurred_at'));
        $decisions = ['restricted' => 0, 'restored' => 0, 'strike_corrected' => 0];
        foreach ($events as $event) if (isset($decisions[$event->action])) $decisions[$event->action]++;
        $decisions['strike_corrected'] = $this->rows($this->period(DB::table('cop_strikes')->whereIn('shopper_user_id', $ids)->whereNotNull('voided_at'), 'voided_at'))->count();
        $expired = $this->rows($this->period(DB::table('cop_restrictions')->whereIn('shopper_user_id', $ids)->whereNull('ended_at')
            ->where('effective_kind', 'temporary')->where('effective_expires_at', '<=', $this->now), 'effective_expires_at'))->count();
        $this->section('cop_decisions', 'COP access decisions and expiry', 'Decisions by occurred_at; corrections by voided_at; expirations by saved effective expiry in the selected Manila dates. Counts are events/outcomes, not distinct current restricted accounts. Manual decisions are GLOBAL; a store filter limits the Shopper activity cohort, not the decision location.',
            $this->columns(['restricted' => 'Manual decisions', 'restored' => 'Restorations', 'strike_corrected' => 'Corrections', 'expired' => 'Expired outcomes']), [$decisions + ['expired' => $expired]]);
        $this->metric('COP globally enabled at generation', app(\App\Services\CopPolicy::class)->current()['enabled'] ? 1 : 0);
    }
}
