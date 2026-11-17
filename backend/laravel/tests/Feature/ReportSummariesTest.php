<?php

namespace Tests\Feature;

use App\Models\InventoryAvailabilityLog;
use App\Models\InventoryBatch;
use App\Models\Order;
use App\Models\StockAdjustment;
use App\Models\StockReceipt;
use App\Models\StoreInventory;
use App\Services\Reports\ReportAccess;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\TransactionTestCase;

class ReportSummariesTest extends TransactionTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['reports.cache_store' => 'array']);
    }

    private function report(string $type, array $filters = [])
    {
        return $this->postJson('/api/reports', ['type' => $type, ...$filters]);
    }
    private function metrics(array $report): array { return array_column($report['metrics'], 'value', 'label'); }
    private function section(array $report, string $key): array { return collect($report['sections'])->firstWhere('key', $key); }
    private function period(): array { return ['from' => '2026-10-19', 'until' => '2026-10-19']; }

    public static function roleReports(): array
    {
        $cases = [];
        foreach (ReportAccess::TYPES as $type => [$label, $period, $roles]) foreach ($roles as $role) $cases[$role.' '.$type] = [$role, $type];
        return $cases;
    }

    #[DataProvider('roleReports')]
    public function test_each_role_report_generates_and_is_readable(string $role, string $type): void
    {
        $user = match ($role) { 'admin' => $this->admin, 'supervisor' => $this->supervisor, default => $this->inventoryWorker };
        $this->signIn($user);
        $options = $this->getJson('/api/reports/options')->assertOk()->assertHeader('Cache-Control', 'no-store, private')->json();
        $this->assertContains($type, array_column($options['types'], 'id'));
        $report = $this->report($type)->assertCreated()->json('report');
        $this->assertSame($role, $report['role']); $this->assertSame($type, $report['type']);
        if (ReportAccess::TYPES[$type][1]) {
            $this->assertSame('2026-10-01', $report['filters']['from']); $this->assertSame('2026-10-19', $report['filters']['until']);
        } else $this->assertArrayNotHasKey('from', $report['filters']);
        $this->getJson('/api/reports/'.$report['id'])->assertOk()->assertJsonPath('report.generated_at', $report['generated_at']);
        $this->get('/api/reports/'.$report['id'].'/pdf', ['Accept' => 'application/pdf'])->assertOk()->assertHeader('Content-Type', 'application/pdf');
        if (getenv('REPORT_PDF_QA') && $role === 'inventory_worker' && $type === 'current_stock') {
            $this->saveQa('basic-short', $this->get('/api/reports/'.$report['id'].'/pdf')->getContent(), $report);
        }
    }

    public function test_worker_cannot_read_payments_or_submit_scope_and_shoppers_cannot_use_reports(): void
    {
        $this->signIn($this->inventoryWorker)->report('payments')->assertForbidden();
        $this->report('current_stock', ['store_id' => $this->otherStore->store_id])->assertUnprocessable();
        $this->signIn($this->shopper)->getJson('/api/reports/options')->assertForbidden();
        $this->signIn($this->admin)->report('payments', ['store_id' => 999999])->assertUnprocessable();
        $this->signIn($this->supervisor)->report('cop')->assertForbidden();
    }

    public static function deniedTypes(): array
    {
        $cases = [];
        foreach (['admin', 'supervisor', 'inventory_worker'] as $role) foreach (ReportAccess::TYPES as $type => [$label, $period, $roles]) {
            if (!in_array($role, $roles, true)) $cases[$role.' '.$type] = [$role, $type];
        }
        return $cases;
    }

    #[DataProvider('deniedTypes')]
    public function test_every_other_role_type_pair_is_denied(string $role, string $type): void
    {
        $this->signIn(match ($role) { 'admin' => $this->admin, 'supervisor' => $this->supervisor, default => $this->inventoryWorker })->report($type)->assertForbidden();
    }

    public static function invalidFilters(): array
    {
        return [
            [['type' => 'payments', 'from' => '2026-11-02', 'until' => '2026-11-01']],
            [['type' => 'payments', 'from' => '2026-01-01', 'until' => '2026-04-04']],
            [['type' => 'payments', 'from' => '2026-02-30']], [['type' => 'unknown']],
            [['type' => 'batches', 'status' => 'made_up']], [['type' => 'current_stock', 'from' => '2026-10-01']],
            [['type' => 'availability', 'search' => str_repeat('a', 101)]], [['type' => 'availability', 'rows' => []]],
            [['type' => 'availability', 'mode' => 'actual']], [['type' => 'payments', 'search' => 'Rice']],
        ];
    }
    #[DataProvider('invalidFilters')]
    public function test_invalid_periods_filters_and_client_rows_are_rejected(array $filters): void
    {
        $this->signIn($this->supervisor)->postJson('/api/reports', $filters)->assertUnprocessable();
    }

    public function test_stock_preserves_units_physical_low_rule_and_available_reservations(): void
    {
        $this->inventory->forceFill(['low_stock_threshold' => 99])->save(); // available 98 is NOT the low-stock basis.
        $product = \Tests\Support\CategoryFixture::product(['store_id' => $this->store->store_id, 'category' => 'QA', 'product_name' => 'Milk bottles', 'sku' => 'MILK', 'selling_unit' => 'bottle']);
        StoreInventory::create(['store_id' => $this->store->store_id, 'product_id' => $product->product_id, 'selling_price' => '10.00', 'hard_stock_qty' => 0, 'status' => 'active']);
        InventoryBatch::create(['store_inventory_id' => $this->inventory->store_inventory_id, 'reference' => 'B-000009', 'quantity_received' => 4, 'remaining_quantity' => 4, 'expiry_date' => '2026-10-18', 'status' => 'on_hold']);
        $r = $this->signIn($this->inventoryWorker)->report('current_stock')->assertCreated()->json('report');
        $m = $this->metrics($r); $this->assertSame(2, $m['Active products']); $this->assertSame(0, $m['Low-stock products']);
        $this->assertSame(1, $m['Out-of-stock products (available = 0)']); $this->assertSame(1, $m['Recorded nondepleted expired batches']);
        $stock = $this->section($r, 'stock')['rows']; $this->assertSame(98, $stock[0]['available']); $this->assertSame('bottle', $stock[1]['unit']);
        $this->inventory->forceFill(['low_stock_threshold' => 100])->save();
        $next = $this->report('current_stock')->assertCreated()->json('report'); $this->assertSame(1, $this->metrics($next)['Low-stock products']);
        $this->assertSame(99, $this->getJson('/api/reports/'.$r['id'])->assertOk()->json('report.sections.0.rows.0.reorder'));
    }

    public function test_batch_dates_numbers_horizon_and_unknown_history_are_truthful(): void
    {
        foreach (['2026-10-18', '2026-10-19', '2026-11-18', '2026-11-19'] as $index => $expiry) {
            InventoryBatch::create(['store_inventory_id' => $this->inventory->store_inventory_id, 'reference' => 'QA-'.$index, 'quantity_received' => 4, 'remaining_quantity' => 3, 'received_date' => '2026-10-01', 'expiry_date' => $expiry, 'status' => 'active']);
        }
        $r = $this->signIn($this->inventoryWorker)->report('batches', ['status' => 'expiring_30'])->assertCreated()->json('report');
        $rows = $this->section($r, 'batches')['rows']; $this->assertCount(2, $rows); $this->assertSame('2026-10-01', $rows[0]['received']);
        $this->assertStringStartsWith('B-', $rows[0]['batch']); $this->assertSame('2026-11-18', $rows[1]['expiry']);
        $this->assertStringContainsString('2026-10-19 through 2026-11-18', $r['sections'][0]['basis']);
    }

    public function test_stock_requests_use_decision_dates_and_recorded_correction_delta_only(): void
    {
        $batch = InventoryBatch::firstOrFail();
        $base = ['store_id' => $this->store->store_id, 'store_inventory_id' => $this->inventory->store_inventory_id, 'requested_by_user_id' => $this->inventoryWorker->id];
        StockReceipt::create([...$base, 'operation_id' => (string) Str::uuid(), 'request_hash' => str_repeat('a', 64), 'quantity' => 7, 'received_date' => '2026-10-01', 'description' => 'Approved addition', 'status' => 'approved', 'created_at' => '2026-10-01 00:00:00', 'decided_at' => '2026-10-19 02:00:00']);
        StockReceipt::create([...$base, 'operation_id' => (string) Str::uuid(), 'request_hash' => str_repeat('b', 64), 'quantity' => 900, 'received_date' => '2026-10-19', 'description' => 'Not approved', 'status' => 'pending']);
        StockReceipt::create([...$base, 'operation_id' => (string) Str::uuid(), 'request_hash' => str_repeat('c', 64), 'quantity' => 800, 'received_date' => '2026-10-19', 'description' => 'Rejected', 'status' => 'rejected', 'decided_at' => now()]);
        $correction = StockAdjustment::create([...$base, 'observed_hard_stock_qty' => 100, 'observed_soft_stock_qty' => 2, 'observed_stock_version' => 1, 'requested_hard_stock_qty' => 95,
            'reason' => 'Count correction', 'status' => 'approved', 'inventory_batch_id' => $batch->id, 'decided_at' => now()]);
        DB::table('batch_correction_logs')->insert(['stock_adjustment_id' => $correction->id, 'inventory_batch_id' => $batch->id, 'quantity_change' => -5, 'created_at' => now(), 'updated_at' => now()]);
        $r = $this->signIn($this->supervisor)->report('stock_changes', $this->period())->assertCreated()->json('report');
        $this->assertSame(['Approved requests' => 2, 'Pending requests' => 1, 'Rejected requests' => 1], $this->metrics($r));
        $impacts = $this->section($r, 'impacts')['rows']; $this->assertSame([7, -5], array_column($impacts, 'delta'));
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty);
    }

    public function test_availability_uses_inclusive_manila_days_and_never_exposes_other_store(): void
    {
        foreach (['2026-10-18 15:59:59', '2026-10-18 16:00:00', '2026-10-19 15:59:59', '2026-10-19 16:00:00'] as $at) {
            InventoryAvailabilityLog::create(['store_id' => $this->store->store_id, 'store_inventory_id' => $this->inventory->store_inventory_id, 'changed_by_user_id' => $this->supervisor->id,
                'previous_status' => 'active', 'new_status' => 'inactive'])->forceFill(['created_at' => $at])->save();
        }
        $r = $this->signIn($this->inventoryWorker)->report('availability', $this->period())->assertCreated()->json('report');
        $this->assertSame(2, $r['sections'][0]['row_count']); $this->assertStringContainsString('12:00 AM', $r['sections'][0]['rows'][0]['at']);
        $this->assertArrayNotHasKey('changed_by_user_id', $r['sections'][0]['rows'][0]);
        $this->signIn($this->foreign)->report('availability', $this->period())->assertCreated()->assertJsonPath('report.sections.0.row_count', 0);
    }

    public function test_payment_groups_do_not_join_multiply_or_subtract_refund_flags_and_legacy_is_separate(): void
    {
        $this->ready(); $this->cash();
        Order::findOrFail($this->orderId)->forceFill(['refund_status' => 'completed'])->save();
        $legacyId = $this->placeOrder();
        $legacy = Order::findOrFail($legacyId); $legacy->update(['payment_method' => 'digital', 'payment_status' => 'paid']);
        DB::table('order_payments')->insert(['order_id' => $legacyId, 'method' => 'digital', 'verification_source' => 'provider', 'provider' => 'historic_provider', 'provider_reference' => 'QA-reference',
            'amount_centavos' => $legacy->total_centavos, 'evidence_type' => 'provider_callback', 'evidence_reference' => 'DO-NOT-EXPORT-EVIDENCE', 'confirmed_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        $testId = $this->placeOrder();
        $testOrder = Order::findOrFail($testId); $testOrder->update(['payment_method' => 'digital', 'payment_status' => 'paid']);
        \App\Models\PaymentCheckoutAttempt::create(['id' => (string) Str::uuid(), 'order_id' => $testId, 'store_id' => $this->store->store_id, 'merchant_id' => 'QA-only', 'credential_fingerprint' => str_repeat('d', 64),
            'mode' => 'test', 'amount_centavos' => $testOrder->total_centavos, 'currency' => 'PHP', 'channels' => ['gcash'], 'status' => 'paid', 'provider_payment_id' => 'QA-test-ref', 'expires_at' => now()->addHour()]);
        DB::table('order_payments')->insert(['order_id' => $testId, 'method' => 'digital', 'verification_source' => 'provider', 'provider' => 'paymongo_test', 'provider_reference' => 'QA-test-ref',
            'amount_centavos' => $testOrder->total_centavos, 'evidence_type' => 'provider_callback', 'evidence_reference' => 'SECRET-TEST-EVIDENCE', 'confirmed_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        $response = $this->signIn($this->supervisor)->report('payments', $this->period())->assertCreated(); $r = $response->json('report'); $m = $this->metrics($r);
        $this->assertSame(13400, $m['Gross actual payments collected']); $this->assertSame(1, $m['Actual verified collections']);
        $this->assertSame(13400, $m['Test / sandbox collections (excluded from actual)']); $this->assertSame(13400, $m['Legacy / unclassified collections (excluded from actual)']);
        $this->assertSame(3, array_sum(array_column($this->section($r, 'payments')['rows'], 'awaiting')));
        foreach (['DO-NOT-EXPORT-EVIDENCE', 'SECRET-TEST-EVIDENCE', 'provider_reference', 'cashier_name', 'shopper_name', 'pin_hash', 'qr_token'] as $secret) $this->assertStringNotContainsString($secret, $response->getContent());
        $this->assertStringContainsString('no order total is deducted', $this->section($r, 'refunds')['basis']);
        DB::table('order_payments')->where('order_id', $this->orderId)->update(['cashier_name' => null]);
        $next = $this->report('payments', $this->period())->assertCreated()->json('report'); $this->assertSame(0, $this->metrics($next)['Gross actual payments collected']);
        $this->assertSame(13400, $this->metrics($this->getJson('/api/reports/'.$r['id'])->assertOk()->json('report'))['Gross actual payments collected']);
    }

    public function test_snapshot_is_bound_to_owner_assignment_approval_role_and_session_and_expiry(): void
    {
        $r = $this->signIn($this->supervisor)->report('current_stock')->assertCreated()->json('report'); $path = '/api/reports/'.$r['id'];
        $this->signIn($this->inventoryWorker)->getJson($path)->assertForbidden(); $this->getJson($path.'/pdf')->assertForbidden();
        $this->signIn($this->supervisor); $this->supervisor->staffStoreAssignment()->update(['store_id' => $this->otherStore->store_id]);
        $this->getJson($path)->assertForbidden(); $this->getJson($path.'/pdf')->assertForbidden();
        $this->supervisor->staffStoreAssignment()->update(['store_id' => $this->store->store_id]);
        $this->supervisor->forceFill(['staff_approved_at' => null])->save(); $this->getJson($path)->assertForbidden();
        $this->supervisor->forceFill(['staff_approved_at' => now()])->save();
        $originalRole = $this->supervisor->role_id;
        $this->supervisor->forceFill(['role_id' => $this->admin->role_id])->save(); $this->getJson($path)->assertForbidden();
        $this->supervisor->forceFill(['role_id' => $originalRole])->save();
        app('session')->driver()->migrate(true); $this->getJson($path)->assertForbidden();
        $this->travel(16)->minutes(); $this->getJson($path)->assertStatus(410); $this->getJson($path.'/pdf')->assertStatus(410);
    }

    public function test_source_unavailable_and_limits_are_errors_not_fabricated_zero_reports(): void
    {
        $this->signIn($this->supervisor);
        config(['reports.max_source_rows' => 0]); $this->report('current_stock')->assertUnprocessable();
        config(['reports.max_source_rows' => 5000, 'reports.max_report_rows' => 0]); $this->report('current_stock')->assertUnprocessable();
        config(['reports.max_report_rows' => 1000, 'reports.max_bytes' => 10]); $this->report('current_stock')->assertUnprocessable();
        config(['reports.max_bytes' => 4000000]); Schema::drop('inventory_availability_logs');
        $this->report('availability')->assertStatus(503);
    }

    public function test_cop_valid_voided_and_global_current_restrictions_are_not_added_per_store(): void
    {
        $second = $this->placeOrder(); $third = $this->placeOrder();
        foreach ([$this->orderId, $second, $third] as $i => $id) DB::table('cop_strikes')->insert(['order_id' => $id, 'shopper_user_id' => $this->shopper->id, 'store_id' => $this->store->store_id,
            'strike_number_at_issue' => $i+1, 'issued_at' => now(), 'voided_at' => $i === 2 ? now() : null, 'created_at' => now(), 'updated_at' => now()]);
        $r = $this->signIn($this->admin)->report('cop', $this->period())->assertCreated()->json('report');
        $this->assertSame(['store' => 'Store A', 'issued' => 3, 'valid' => 2, 'voided' => 1], $r['sections'][0]['rows'][0]);
        $this->assertSame(['temporary' => 1, 'permanent' => 0], $r['sections'][1]['rows'][0]);
    }

    public function test_pagination_and_pdf_use_original_snapshot_after_stock_changes(): void
    {
        for ($i = 1; $i <= 29; $i++) {
            $product = \Tests\Support\CategoryFixture::product(['store_id' => $this->store->store_id, 'category' => 'QA', 'product_name' => 'Saved report product '.str_pad((string) $i, 2, '0', STR_PAD_LEFT), 'sku' => 'PDF-'.$i, 'selling_unit' => 'pack']);
            StoreInventory::create(['store_id' => $this->store->store_id, 'product_id' => $product->product_id, 'selling_price' => '10.00', 'hard_stock_qty' => $i, 'status' => 'active']);
        }
        $r = $this->signIn($this->inventoryWorker)->report('current_stock')->assertCreated()->json('report');
        $this->assertCount(25, $r['sections'][0]['rows']); $this->assertSame(30, $r['sections'][0]['row_count']);
        $this->inventory->update(['hard_stock_qty' => 80]);
        $this->getJson('/api/reports/'.$r['id'].'?pages[stock]=2')->assertOk()->assertJsonCount(5, 'report.sections.0.rows')->assertJsonPath('report.generated_at', $r['generated_at']);
        $this->getJson('/api/reports/'.$r['id'].'?pages[bad]=2')->assertUnprocessable();
        $response = $this->get('/api/reports/'.$r['id'].'/pdf', ['Accept' => 'application/pdf'])->assertOk()->assertHeader('Content-Type', 'application/pdf')->assertHeader('Cache-Control', 'no-store, private');
        $this->assertStringStartsWith('%PDF-', $response->getContent());
        $this->assertSame(80, $this->inventory->fresh()->hard_stock_qty); $this->assertDatabaseCount('order_payments', 0);
        if (getenv('REPORT_PDF_QA')) {
            $dir = base_path('../../tmp/pdfs/reports'); if (!is_dir($dir)) mkdir($dir, 0777, true);
            file_put_contents($dir.'/stock-multipage.pdf', $response->getContent()); file_put_contents($dir.'/stock-multipage.json', json_encode($r, JSON_PRETTY_PRINT));
        }
    }

    public function test_multiple_items_and_depleted_batches_do_not_multiply_collections(): void
    {
        $product = \Tests\Support\CategoryFixture::product(['store_id' => $this->store->store_id, 'product_name' => 'Milk', 'sku' => 'PAY-MILK', 'category' => 'QA', 'selling_unit' => 'bottle']);
        $item = StoreInventory::create(['store_id' => $this->store->store_id, 'product_id' => $product->product_id, 'selling_price' => '50.00', 'hard_stock_qty' => 20, 'status' => 'active']);
        $cart = $this->cart(); $cart['items'][] = ['store_inventory_id' => $item->store_inventory_id, 'quantity' => 1];
        $this->signIn($this->shopper); $quote = $this->postJson('/api/shopper/checkout/quote', $cart)->assertOk()->json('quote_token');
        $this->orderId = $this->postJson('/api/shopper/orders', [...$cart, 'quote_token' => $quote, 'idempotency_key' => (string) Str::uuid()])->assertCreated()->json('order.order_id');
        $this->ready(); $this->cash();
        InventoryBatch::create(['store_inventory_id' => $item->store_inventory_id, 'reference' => 'QA-depleted', 'quantity_received' => 9, 'remaining_quantity' => 0, 'status' => 'active']);
        $r = $this->report('payments', $this->period())->assertCreated()->json('report');
        $this->assertSame(18400, $this->metrics($r)['Gross actual payments collected']);
        $this->assertSame(1, $this->section($r, 'payments')['rows'][0]['count']);
    }

    public function test_completed_handovers_and_paid_awaiting_pickup_have_separate_event_bases(): void
    {
        $secret = $this->ready(); $this->cash();
        $this->postJson($this->path('claim'), ['method' => 'pin', 'credential' => $secret['pin'], 'claiming_as' => 'shopper', 'identity_checked' => true, 'physically_handed_over' => true])->assertOk();
        // Collection was before the selected date; genuine handover is in it.
        DB::table('order_payments')->where('order_id', $this->orderId)->update(['confirmed_at' => '2026-10-18 15:59:59']);
        $r = $this->report('payments', $this->period())->assertCreated()->json('report');
        $this->assertSame(0, $this->metrics($r)['Gross actual payments collected']);
        $this->assertSame(1, $this->section($r, 'handovers')['rows'][0]['count']);
        $this->assertSame(0, $this->section($r, 'payments')['row_count']);
    }

    public function test_real_pdf_short_empty_and_unicode_samples_are_read_only_and_escaped(): void
    {
        $this->store->update(['store_name' => 'QA Store with a long recorded name '.str_repeat('LongName ', 12)]);
        $this->inventory->product->update(['product_name' => 'Caf'."\u{00e9} \u{20b1}".' <script>NEVER-EXECUTE</script> '.str_repeat('Long product ', 10)]);
        $this->signIn($this->supervisor);
        $samples = ['stock-short' => ['current_stock', []], 'empty' => ['availability', $this->period()]];
        foreach ($samples as $filename => [$type, $filters]) {
            $r = $this->report($type, $filters)->assertCreated()->json('report');
            $pdf = $this->get('/api/reports/'.$r['id'].'/pdf', ['Accept' => 'application/pdf'])->assertOk();
            $html = view('reports.summary', ['report' => $r])->render();
            $this->assertStringNotContainsString('<script>NEVER-EXECUTE</script>', $html);
            if (getenv('REPORT_PDF_QA')) $this->saveQa($filename, $pdf->getContent(), $r);
        }
        $this->ready(); $this->cash();
        $r = $this->signIn($this->supervisor)->report('payments', $this->period())->assertCreated()->json('report');
        $pdf = $this->get('/api/reports/'.$r['id'].'/pdf', ['Accept' => 'application/pdf'])->assertOk();
        if (getenv('REPORT_PDF_QA')) $this->saveQa('payments', $pdf->getContent(), $r);
        $this->assertSame(100, $this->inventory->fresh()->hard_stock_qty); $this->assertDatabaseCount('order_handovers', 0); $this->assertDatabaseCount('order_payments', 1);
    }

    private function saveQa(string $name, string $pdf, array $report): void
    {
        $dir = base_path('../../tmp/pdfs/reports'); if (!is_dir($dir)) mkdir($dir, 0777, true);
        file_put_contents($dir.'/'.$name.'.pdf', $pdf); file_put_contents($dir.'/'.$name.'.json', json_encode($report, JSON_PRETTY_PRINT));
    }

    public function test_search_and_status_narrow_sources_and_literal_wildcards_are_not_matches(): void
    {
        $this->inventory->product->update(['product_name' => 'Rice 10%_QA']);
        $this->signIn($this->inventoryWorker);
        $this->report('current_stock', ['search' => '10%_'])->assertCreated()->assertJsonPath('report.sections.0.row_count', 1);
        $this->report('current_stock', ['search' => 'not present'])->assertCreated()->assertJsonPath('report.sections.0.row_count', 0);
        $batch = InventoryBatch::firstOrFail(); $number = InventoryBatch::displayNumber($batch->id, $batch->reference);
        $this->report('batches', ['search' => $number])->assertCreated()->assertJsonPath('report.sections.0.row_count', 1);
        $this->report('batches', ['status' => 'expired'])->assertCreated()->assertJsonPath('report.sections.0.row_count', 0);
    }

    public function test_private_file_cache_preserves_snapshot_across_reads_and_has_no_business_writes(): void
    {
        $directory = base_path('../../tmp/report-cache-'.Str::uuid());
        config(['cache.stores.reports_qa_file' => ['driver' => 'file', 'path' => $directory], 'reports.cache_store' => 'reports_qa_file']);
        try {
            $r = $this->signIn($this->supervisor)->report('current_stock')->assertCreated()->json('report');
            $this->assertNotNull(Cache::store('reports_qa_file')->get('report:'.$r['id']));
            $this->inventory->update(['hard_stock_qty' => 80]);
            $this->getJson('/api/reports/'.$r['id'])->assertOk()->assertJsonPath('report.sections.0.rows.0.physical', 100);
            $this->get('/api/reports/'.$r['id'].'/pdf')->assertOk();
            $this->assertSame(80, $this->inventory->fresh()->hard_stock_qty); $this->assertDatabaseCount('order_payments', 0); $this->assertDatabaseCount('order_handovers', 0);
        } finally {
            $resolved = realpath($directory); $root = realpath(base_path('../../tmp'));
            if ($resolved && $root && str_starts_with($resolved, $root.DIRECTORY_SEPARATOR.'report-cache-')) \Illuminate\Support\Facades\File::deleteDirectory($resolved);
        }
    }

    public function test_legacy_multi_batch_corrections_group_each_recorded_delta_without_inventing_deliveries(): void
    {
        $first = InventoryBatch::firstOrFail();
        $second = InventoryBatch::create(['store_inventory_id' => $this->inventory->store_inventory_id, 'reference' => 'QA-historical-second', 'quantity_received' => 10, 'remaining_quantity' => 0, 'status' => 'active']);
        $record = StockAdjustment::create(['store_id' => $this->store->store_id, 'store_inventory_id' => $this->inventory->store_inventory_id, 'requested_by_user_id' => $this->inventoryWorker->id,
            'observed_hard_stock_qty' => 100, 'observed_soft_stock_qty' => 2, 'observed_stock_version' => 1, 'requested_hard_stock_qty' => 98, 'reason' => 'Legacy multi-batch correction', 'status' => 'approved', 'decided_at' => now()]);
        foreach ([[$first, -5], [$second, 3]] as [$batch, $delta]) DB::table('batch_correction_logs')->insert(['stock_adjustment_id' => $record->id, 'inventory_batch_id' => $batch->id, 'quantity_change' => $delta, 'created_at' => now(), 'updated_at' => now()]);
        $r = $this->signIn($this->supervisor)->report('stock_changes', $this->period())->assertCreated()->json('report');
        $this->assertSame([-5, 3], array_column($r['sections'][0]['rows'], 'delta'));
        $this->assertSame('Multiple recorded batches (2)', $r['sections'][1]['rows'][0]['batch']);
        $this->assertSame(-2, $r['sections'][1]['rows'][0]['delta']);
        $number = InventoryBatch::displayNumber($second->id, $second->reference);
        $filtered = $this->report('stock_changes', [...$this->period(), 'search' => strtolower($number)])->assertCreated()->json('report');
        $this->assertSame(1, $filtered['sections'][0]['row_count']); $this->assertSame(3, $filtered['sections'][0]['rows'][0]['delta']);
    }

    public function test_unsupported_currency_is_an_honest_error_instead_of_a_php_total(): void
    {
        $this->ready(); $this->cash();
        Order::findOrFail($this->orderId)->update(['currency' => 'USD']);
        $this->report('payments', $this->period())->assertUnprocessable()->assertJsonMissingPath('report');
    }

    public function test_payment_midnight_boundaries_use_manila_calendar_dates(): void
    {
        foreach (['2026-10-18 15:59:59', '2026-10-18 16:00:00', '2026-10-19 15:59:59', '2026-10-19 16:00:00'] as $at) {
            $this->orderId = $this->placeOrder(); $this->ready(); $this->cash();
            DB::table('order_payments')->where('order_id', $this->orderId)->update(['confirmed_at' => $at]);
        }
        $r = $this->signIn($this->admin)->report('payments', $this->period())->assertCreated()->json('report');
        $this->assertSame(26800, $this->metrics($r)['Gross actual payments collected']);
        $this->assertSame(2, $this->metrics($r)['Actual verified collections']);
    }

    public function test_operations_separate_placed_cohort_events_and_current_inventory_by_store(): void
    {
        $secret = $this->ready(); $this->cash();
        $this->postJson($this->path('claim'), ['method' => 'pin', 'credential' => $secret['pin'], 'claiming_as' => 'shopper', 'identity_checked' => true, 'physically_handed_over' => true])->assertOk();
        Order::findOrFail($this->orderId)->forceFill(['created_at' => '2026-10-01 01:00:00'])->save();
        $r = $this->report('order_operations', $this->period())->assertCreated()->json('report');
        $this->assertSame(0, $this->metrics($r)['Orders placed in period']);
        $this->assertSame(1, $this->section($r, 'events')['rows'][0]['completed']);
        $this->assertSame(1, $this->section($r, 'events')['rows'][0]['handovers']);
        $admin = $this->signIn($this->admin)->report('store_operations', [...$this->period(), 'store_id' => $this->otherStore->store_id])->assertCreated()->json('report');
        $this->assertSame('Store B', $admin['store_label']); $this->assertSame(0, $this->metrics($admin)['Orders placed in period']);
        $this->assertSame(0, $this->section($admin, 'inventory')['rows'][0]['active']);
    }
}
