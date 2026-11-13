<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Services\DocumentPdf;
use Illuminate\Support\Facades\DB;
use Tests\Support\TransactionTestCase;

class AdviserOrdersDocumentsTest extends TransactionTestCase
{
    private function complete(): void
    {
        $credential = $this->ready(); $this->cash();
        $this->signIn($this->supervisor)->postJson($this->path('pickup-verification'), $this->identity($credential))->assertOk();
        $this->putJson($this->path('handover'), ['physically_handed_over' => true])->assertOk();
    }

    public function test_reference_lookup_is_store_scoped_and_does_not_authorize_handover(): void
    {
        $this->signIn($this->supervisor)->getJson('/api/supervisor/order-lookup?reference=GE-'.$this->orderId)->assertOk()
            ->assertJsonPath('order.order_id', $this->orderId)->assertJsonPath('order.payment_status', 'unpaid');
        $this->putJson($this->path('handover'), ['physically_handed_over' => true])->assertConflict();
        $this->getJson('/api/supervisor/order-lookup?reference=bad-ref')->assertUnprocessable();
        $this->signIn($this->foreign)->getJson('/api/supervisor/order-lookup?reference='.$this->orderId)->assertNotFound();
        $this->signIn($this->inventoryWorker)->getJson('/api/supervisor/order-lookup?reference='.$this->orderId)->assertForbidden();
        $this->complete();
        $handover = DB::table('order_handovers')->first(); $payment = DB::table('order_payments')->first();
        $this->signIn($this->supervisor)->getJson('/api/supervisor/order-lookup?reference=GE-'.$this->orderId.'-'.$handover->id)->assertOk()->assertJsonPath('notice', 'This order is already completed. Another handover is not permitted.');
        $this->getJson('/api/supervisor/order-lookup?reference=TX-'.$payment->id)->assertOk()->assertJsonPath('order.order_id', $this->orderId);
        $this->assertDatabaseCount('order_handovers', 1);
    }

    public function test_invoice_is_a_unique_immutable_pro_forma_and_preserves_existing_receipt(): void
    {
        $this->signIn($this->shopper)->postJson($this->shopperPath('invoice'))->assertConflict();
        $this->complete();
        $original = $this->signIn($this->shopper)->postJson($this->shopperPath('invoice'))->assertCreated()
            ->assertJsonPath('invoice.official_invoice', false)->assertJsonPath('invoice.label', 'Draft / Pro Forma')->json('invoice');
        $this->signIn($this->supervisor)->postJson($this->path('invoice'))->assertOk()->assertJsonPath('invoice.reference', $original['reference']);
        $this->assertDatabaseCount('order_invoices', 1);
        $this->inventory->product->update(['product_name' => 'Renamed current product', 'selling_unit' => 'box']);
        $this->inventory->selling_price = '99.00'; $this->inventory->save();
        $this->signIn($this->admin)->putJson('/api/admin/stores/'.$this->store->store_id.'/invoice-settings', [
            'registered_name' => 'Fixture seller name', 'tax_registration' => 'vat', 'review_notes' => 'Test-only seller review fixture.',
        ])->assertOk();
        $this->signIn($this->shopper)->getJson($this->shopperPath('invoice'))->assertOk()->assertJsonPath('invoice', $original);
        $this->getJson($this->shopperPath('receipt'))->assertOk()->assertJsonPath('receipt.order.total_centavos', 13400);
        $this->assertDatabaseCount('invoice_audits', 2); // Initial generation + Admin seller settings.
    }

    public function test_invoice_permissions_and_official_enable_overrides_are_protected(): void
    {
        $this->complete();
        $this->signIn($this->shopper)->postJson($this->shopperPath('invoice'))->assertCreated();
        $this->signIn($this->other)->getJson($this->shopperPath('invoice'))->assertNotFound();
        $this->postJson($this->shopperPath('invoice'))->assertNotFound();
        $this->signIn($this->foreign)->getJson($this->path('invoice'))->assertNotFound();
        $this->signIn($this->inventoryWorker)->getJson($this->path('invoice'))->assertForbidden();
        $this->signIn($this->shopper)->putJson('/api/admin/stores/'.$this->store->store_id.'/invoice-settings', [])->assertForbidden();
        $this->signIn($this->admin)->putJson('/api/admin/stores/'.$this->store->store_id.'/invoice-settings', ['tax_registration' => 'vat', 'review_notes' => 'Review', 'official_issuance_enabled' => true])->assertUnprocessable();
    }

    public function test_real_invoice_and_report_exports_are_pdf_and_escaped_unicode_is_renderable(): void
    {
        $this->complete();
        $this->signIn($this->shopper)->postJson($this->shopperPath('invoice'))->assertCreated();
        $invoice = $this->get($this->shopperPath('invoice.pdf'))->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringStartsWith('%PDF-', $invoice->getContent());
        $report = $this->signIn($this->supervisor)->get('/api/supervisor/reports/orders.pdf')->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringStartsWith('%PDF-', $report->getContent());
        $this->assertDatabaseHas('invoice_audits', ['action' => 'pdf_export']);
        if (getenv('ADVISER_PDF_QA') === '1') {
            $directory = base_path('../../tmp/pdf-qa'); if (! is_dir($directory)) mkdir($directory, 0755, true);
            file_put_contents($directory.'/invoice.pdf', $invoice->getContent());
            file_put_contents($directory.'/orders.pdf', $report->getContent());
            $rows = [];
            for ($index = 1; $index <= 100; $index++) $rows[] = ['GE-'.$index, 'QA supermarket', 'QA Shopper', 'Nov 13, 2026 10:30 AM', 'ready_for_pickup / claimable', 'cash_on_pickup / unpaid', '₱1,234.56'];
            file_put_contents($directory.'/multipage-report.pdf', app(DocumentPdf::class)->render('pdf.report', ['report' => [
                'report_title' => 'Pagination QA — fixture records', 'scope' => 'QA store', 'from' => '2026-11-01', 'until' => '2026-11-13',
                'generated_at' => 'Nov 13, 2026 02:00 PM (Asia/Manila)', 'filters' => [],
                'headings' => ['Order', 'Store', 'Shopper', 'Pickup (PH)', 'Preparation / Claim', 'Payment', 'Total'],
                'rows' => $rows, 'totals' => ['Fixture records' => 100], 'note' => 'Rendering fixture only; these records are not business data.',
            ]], true));
        }
    }

    public function test_report_filters_use_actual_scoped_records_and_philippine_dates(): void
    {
        $this->complete();
        $this->mock(DocumentPdf::class, function ($mock) {
            $mock->shouldReceive('render')->once()->with('pdf.report', \Mockery::on(function ($data) {
                $report = $data['report'];
                $this->assertSame('Store A', $report['scope']);
                $this->assertCount(1, $report['rows']);
                $this->assertSame('₱134.00', $report['totals']['Gross payments (excluding completed refunds)']);
                return true;
            }), true)->andReturn('%PDF-test');
            $mock->shouldReceive('download')->once()->andReturn(response('%PDF-test', 200, ['Content-Type' => 'application/pdf']));
        });
        $this->signIn($this->supervisor)->get('/api/supervisor/reports/transactions.pdf?from=2026-10-19&until=2026-10-19&search='.$this->orderId)->assertOk();
    }

    public function test_report_role_scope_and_invalid_filters_are_enforced(): void
    {
        $this->signIn($this->supervisor)->get('/api/supervisor/reports/stock.pdf?store_id='.$this->otherStore->store_id)->assertUnprocessable();
        $this->get('/api/supervisor/reports/cop.pdf')->assertForbidden();
        $this->getJson('/api/supervisor/reports/orders.pdf?from=2026-11-20&until=2026-11-01')->assertUnprocessable();
        $this->getJson('/api/supervisor/reports/stock.pdf?from=2026-11-01')->assertUnprocessable();
        $this->getJson('/api/supervisor/reports/sales.pdf?category=Staples')->assertUnprocessable();
        $this->getJson('/api/supervisor/reports/transactions.pdf?status=paid')->assertUnprocessable();
        $this->signIn($this->shopper)->getJson('/api/admin/reports/stock.pdf')->assertForbidden();
        $this->signIn($this->admin)->get('/api/admin/reports/stock.pdf')->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->get('/api/admin/reports/cop.pdf')->assertOk()->assertHeader('Content-Type', 'application/pdf');
    }
}
