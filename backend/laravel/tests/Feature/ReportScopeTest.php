<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\StoreInventory;
use App\Services\DocumentPdf;
use Illuminate\Support\Facades\DB;
use Tests\Support\TransactionTestCase;

class ReportScopeTest extends TransactionTestCase
{
    public function test_worker_has_only_assigned_store_stock_reports_with_matching_json_pdf_and_no_writes(): void
    {
        $product = Product::create(['store_id' => $this->otherStore->store_id, 'product_name' => 'Foreign item', 'category' => 'Staples']);
        StoreInventory::create(['store_id' => $this->otherStore->store_id, 'product_id' => $product->product_id, 'selling_price' => '25.00', 'hard_stock_qty' => 5, 'status' => 'active']);
        $this->inventory->low_stock_threshold = 100; $this->inventory->save();
        $before = $this->snapshot();
        $report = $this->signIn($this->inventoryWorker)->getJson('/api/inventory/reports/stock?search=Rice&status=active&category=Staples')->assertOk()
            ->assertJsonPath('report.scope', 'Store A')->assertJsonPath('pagination.total', 1)->assertJsonPath('report.totals.Physical units', 100)->json('report');
        $this->assertStringNotContainsString('Foreign item', json_encode($report));
        $this->mock(DocumentPdf::class, function ($mock) use ($report) {
            $mock->shouldReceive('render')->once()->with('pdf.report', \Mockery::on(function ($data) use ($report) { $this->assertSame($report['rows'], $data['report']['rows']); $this->assertSame($report['totals'], $data['report']['totals']); $this->assertSame($report['filters'], $data['report']['filters']); return true; }), true)->andReturn('%PDF-fixture');
            $mock->shouldReceive('download')->once()->andReturn(response('%PDF-fixture', 200, ['Content-Type' => 'application/pdf']));
        });
        $this->get('/api/inventory/reports/stock.pdf?search=Rice&status=active&category=Staples')->assertOk();
        $this->getJson('/api/inventory/reports/low-stock')->assertOk()->assertJsonPath('pagination.total', 1);
        foreach (['sales','transactions','orders','cop'] as $kind) $this->getJson('/api/inventory/reports/'.$kind.'.pdf')->assertForbidden();
        $this->getJson('/api/inventory/reports/stock.pdf?store_id='.$this->otherStore->store_id)->assertUnprocessable();
        $this->getJson('/api/inventory/reports/stock.pdf?from=2026-10-19')->assertUnprocessable();
        $this->assertSame($before, $this->snapshot());
    }

    public function test_worker_assignments_and_staff_role_routes_are_enforced_by_backend(): void
    {
        foreach (['inventory','supervisor','admin'] as $prefix) $this->signIn($this->shopper)->getJson('/api/'.$prefix.'/reports/stock.pdf')->assertForbidden();
        $this->signIn($this->inventoryWorker)->getJson('/api/admin/reports/stock.pdf')->assertForbidden();
        $this->getJson('/api/supervisor/reports/stock.pdf')->assertForbidden();
        $this->store->forceFill(['status' => 'inactive'])->save();
        $this->getJson('/api/inventory/reports/stock.pdf')->assertForbidden();
        $this->signIn($this->supervisor)->getJson('/api/supervisor/reports/orders.pdf')->assertForbidden();
    }

    public function test_admin_store_scope_and_empty_pdf_are_real_and_supervisor_remains_assigned(): void
    {
        $before = $this->snapshot();
        $this->signIn($this->admin)->getJson('/api/admin/reports/stock')->assertOk()->assertJsonPath('report.scope', 'All stores')->assertJsonPath('pagination.total', 1);
        $this->getJson('/api/admin/reports/stock?store_id='.$this->otherStore->store_id)->assertOk()->assertJsonPath('report.scope', 'Store B')->assertJsonPath('pagination.total', 0)->assertJsonPath('report.totals.Physical units', 0);
        $pdf = $this->get('/api/admin/reports/stock.pdf?store_id='.$this->otherStore->store_id)->assertOk()->assertHeader('Content-Type','application/pdf');
        $this->assertStringStartsWith('%PDF-', $pdf->getContent());
        $workerPdf = $this->signIn($this->inventoryWorker)->get('/api/inventory/reports/stock.pdf')->assertOk()->assertHeader('Content-Type','application/pdf');
        $this->assertStringStartsWith('%PDF-', $workerPdf->getContent());
        $this->signIn($this->supervisor)->getJson('/api/supervisor/reports/orders?status=waiting&from=2026-10-19&until=2026-10-19')->assertOk()->assertJsonPath('pagination.total', 1)->assertJsonPath('report.totals.Historical order totals (not revenue)', '₱134.00');
        $this->getJson('/api/supervisor/reports/orders?store_id='.$this->otherStore->store_id)->assertUnprocessable();
        $this->assertSame($before, $this->snapshot());
    }

    public function test_report_pagination_has_full_filtered_totals_and_export_does_not_truncate_to_ui_page(): void
    {
        $rows = [];
        for ($i = 0; $i < 55; $i++) {
            $product = Product::create(['store_id' => $this->store->store_id, 'product_name' => 'Page fixture '.$i, 'category' => 'Report']);
            $rows[] = ['store_id' => $this->store->store_id, 'product_id' => $product->product_id, 'selling_price' => '1.00', 'hard_stock_qty' => 1, 'soft_stock_qty' => 0, 'status' => 'active', 'created_at' => now(), 'updated_at' => now()];
        }
        DB::table('store_inventory')->insert($rows);
        $report = $this->signIn($this->inventoryWorker)->getJson('/api/inventory/reports/stock?category=Report&page=2')->assertOk()->assertJsonCount(5,'report.rows')->assertJsonPath('pagination.total',55)->assertJsonPath('report.totals.Physical units',55);
        $this->mock(DocumentPdf::class, function ($mock) {
            $mock->shouldReceive('render')->once()->with('pdf.report', \Mockery::on(function ($data) { $this->assertCount(55,$data['report']['rows']); $this->assertSame(55,$data['report']['totals']['Physical units']); return true; }), true)->andReturn('%PDF-fixture');
            $mock->shouldReceive('download')->once()->andReturn(response('%PDF-fixture',200,['Content-Type'=>'application/pdf']));
        });
        $this->get('/api/inventory/reports/stock.pdf?category=Report')->assertOk();
    }

    private function snapshot(): array
    {
        $state=[]; foreach (['stores','products','store_inventory','orders','order_items','order_payments','stock_batches','stock_alerts','stock_alert_states','cop_strikes'] as $table) $state[$table]=DB::table($table)->get()->toJson(); return $state;
    }
}
