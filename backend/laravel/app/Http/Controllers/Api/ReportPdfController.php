<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Store;
use App\Models\StoreInventory;
use App\Services\DocumentPdf;
use App\Services\StoreStaffAccess;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ReportPdfController extends Controller
{
    public function export(Request $request, string $kind, DocumentPdf $pdf, StoreStaffAccess $access)
    {
        $input = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'], 'until' => ['nullable', 'date_format:Y-m-d', ...($request->filled('from') ? ['after_or_equal:from'] : [])],
            'store_id' => ['nullable', 'integer', 'min:1'], 'search' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', 'max:50'], 'category' => ['nullable', 'string', 'max:100'], 'upcoming' => ['nullable', 'boolean'],
        ]);
        $report = DB::transaction(function () use ($request, $kind, $access, $input) {
            $role = $request->user()->role?->slug;
            abort_unless(in_array($kind, ['orders', 'stock', 'transactions', 'sales', 'cop'], true), 404);
            abort_if(! empty($input['category']) && $kind !== 'stock', 422, 'Category filters apply only to stock reports.');
            abort_if(! empty($input['status']) && ! in_array($kind, ['stock', 'orders'], true), 422, 'Status filters apply only to stock or order reports.');
            abort_if(! empty($input['upcoming']) && $kind !== 'orders', 422, 'Upcoming pickup filters apply only to order reports.');
            $store = null;
            if ($role === 'supervisor') {
                abort_if(isset($input['store_id']), 422, 'Supervisor report scope comes from the assigned store.');
                abort_if($kind === 'cop', 403);
                $store = $access->resolve($request->user(), ['supervisor'])['store'];
            } else {
                abort_unless($role === 'admin', 403);
                if (isset($input['store_id'])) $store = Store::findOrFail($input['store_id']);
            }
            $scope = $store ? $store->store_name : 'All stores';
            $meta = ['title' => '', 'scope' => $scope, 'from' => $input['from'] ?? null, 'until' => $input['until'] ?? null,
                'generated_at' => now('Asia/Manila')->format('M d, Y h:i A').' (Asia/Manila)', 'filters' => collect($input)->except('store_id')->filter(fn ($v) => $v !== null && $v !== '')->all()];
            $search = mb_strtolower($input['search'] ?? '');
            $matches = fn (array $values) => $search === '' || str_contains(mb_strtolower(implode(' ', $values)), $search);
            $money = fn (int $centavos) => '₱'.number_format($centavos / 100, 2);
            if (in_array($kind, ['sales', 'transactions'], true)) {
                $records = app(TransactionRecordsController::class)->reportRecords($store?->store_id)
                    ->filter(fn ($r) => $this->inRange($r->confirmed_at, $input) && $matches([$r->order_id, $r->store_name, $r->shopper_name, $r->payment_method]));
                $rows = $records->map(fn ($r) => ['TX-'.$r->transaction_id.' / GE-'.$r->order_id, $r->store_name, $r->shopper_name,
                    $this->date($r->confirmed_at), $r->payment_method.' / '.$r->payment_status, $r->refund_status,
                    $money((int) $r->amount_centavos)])->values()->all();
                return $meta + ['title_unused' => '', 'headings' => ['Transaction / Order', 'Store', 'Shopper', 'Confirmed (PH)', 'Payment', 'Refund', 'Paid'],
                    'rows' => $rows, 'report_title' => $kind === 'sales' ? 'Verified Sales Payments' : 'Verified Transaction Report',
                    'totals' => ['Verified records' => count($rows), 'Gross payments (excluding completed refunds)' => $money((int) $records->where('refund_status', '!=', 'completed')->sum('amount_centavos'))],
                    'note' => 'Payment confirmation dates use Asia/Manila. Gross supermarket payments are not platform revenue. No invented service charges, tax or worker payouts.'];
            }
            if ($kind === 'stock') {
                $query = StoreInventory::query()->whereHas('product', fn ($q) => $q->whereColumn('products.store_id', 'store_inventory.store_id'))->with(['product', 'store']);
                if ($store) $query->where('store_inventory.store_id', $store->store_id);
                $records = $query->orderBy('store_inventory_id')->get()->filter(fn ($r) => $matches([$r->product->product_name, $r->product->sku, $r->product->barcode, $r->product->category, $r->product->size])
                    && empty($input['from']) && empty($input['until'])
                    && (empty($input['category']) || $r->product->category === $input['category']) && (empty($input['status']) || $r->status === $input['status']));
                abort_if(! empty($input['from']) || ! empty($input['until']), 422, 'Stock reports show the current snapshot. Historical inventory balances are not inferred from date filters.');
                $rows = $records->map(fn ($r) => [$r->store->store_name, $r->product->product_name.' / '.$r->product->sku,
                    $r->product->category, $r->product->selling_unit ?? 'Unspecified', $r->hard_stock_qty, $r->soft_stock_qty,
                    $r->availableStock(), $r->low_stock_threshold ?? 'Not set', $r->status])->values()->all();
                return $meta + ['report_title' => 'Current Stock Report', 'period_label' => 'Current snapshot at generation time', 'headings' => ['Store', 'Product / SKU', 'Category', 'Unit', 'Physical', 'Reserved', 'Sellable', 'Reorder level', 'Status'], 'rows' => $rows,
                    'totals' => ['Products' => count($rows), 'Physical units' => $records->sum('hard_stock_qty'), 'Reserved units' => $records->sum('soft_stock_qty'), 'Sellable units' => $records->sum(fn ($r) => $r->availableStock())],
                    'note' => 'Current snapshot. Sellable availability excludes reservations and expired/quarantined batch remainder. Legacy stock has no inferred receiving or expiry date.'];
            }
            if ($kind === 'orders') {
                $query = Order::query(); if ($store) $query->where('store_id', $store->store_id);
                $records = $query->orderBy('order_id')->get()->filter(fn ($r) => $this->inRange($r->created_at, $input)
                    && $matches([$r->order_id, 'GE-'.$r->order_id, $r->store_name, $r->shopper_name])
                    && (empty($input['status']) || $r->status === $input['status'])
                    && (empty($input['upcoming']) || (in_array($r->status, ['waiting', 'preparing', 'ready_for_pickup'], true) && $r->pickup_window_end_at?->gte(now()))));
                return $meta + ['report_title' => 'Order Summary', 'headings' => ['Order', 'Store', 'Shopper', 'Pickup (PH)', 'Preparation / Claim', 'Payment', 'Order total'],
                    'rows' => $records->map(fn ($r) => ['GE-'.$r->order_id, $r->store_name, $r->shopper_name, $this->date($r->pickup_window_start_at),
                        $r->status.' / '.$r->claim_status, $r->payment_method.' / '.$r->payment_status, $money($r->total_centavos)])->values()->all(),
                    'totals' => ['Orders' => $records->count(), 'Historical order totals (not revenue)' => $money((int) $records->sum('total_centavos'))],
                    'note' => 'Date range uses order creation dates in Asia/Manila. Order totals include unpaid/canceled records when those states match filters; they are not recognized revenue.'];
            }
            $query = DB::table('cop_strikes')->join('stores', 'stores.store_id', '=', 'cop_strikes.store_id')->join('users', 'users.id', '=', 'cop_strikes.shopper_user_id');
            if ($store) $query->where('cop_strikes.store_id', $store->store_id);
            $records = $query->orderBy('cop_strikes.id')->get(['cop_strikes.*', 'stores.store_name', 'users.email'])
                ->filter(fn ($r) => $this->inRange($r->created_at, $input) && $matches([$r->id, $r->order_id, $r->store_name, $r->email]));
            return $meta + ['report_title' => 'COP Failures and Restrictions', 'headings' => ['Strike', 'Store / Order', 'Shopper', 'Recorded (PH)', 'Audit status', 'Current restriction'],
                'rows' => $records->map(function ($r) {
                    $state = app(\App\Services\CopRestrictions::class)->status($r->shopper_user_id);
                    return [$r->id, $r->store_name.' / GE-'.$r->order_id, $r->email, $this->date($r->created_at), $r->voided_at ? 'Voided: '.$r->correction_reason : 'Active strike',
                        $state['allowed'] ? 'COP available' : ($state['permanently_disabled'] ? 'Permanently disabled' : 'Until '.$this->date($state['disabled_until']))];
                })->values()->all(), 'totals' => ['Failure records' => $records->count(), 'Active strikes in selection' => $records->whereNull('voided_at')->count()],
                'note' => 'Failure date filters apply to strike records. Restriction state is current across the Shopper account; a COP restriction does not deactivate the account.'];
        }, 3);
        abort_if(count($report['rows']) > 5000, 422, 'This report exceeds 5,000 records. Narrow the filters before exporting. No records were omitted.');
        return $pdf->download($pdf->render('pdf.report', ['report' => $report], true), 'grocerease-'.$kind.'-'.now('Asia/Manila')->format('Y-m-d').'.pdf');
    }

    private function date($value): string { return $value ? Carbon::parse($value, 'UTC')->setTimezone('Asia/Manila')->format('M d, Y h:i A') : 'Not recorded'; }
    private function inRange($value, array $input): bool
    {
        $day = $value ? Carbon::parse($value, 'UTC')->setTimezone('Asia/Manila')->format('Y-m-d') : '';
        return (empty($input['from']) || $day >= $input['from']) && (empty($input['until']) || $day <= $input['until']);
    }
}
