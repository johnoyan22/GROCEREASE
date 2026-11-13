<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Store;
use App\Services\DocumentPdf;
use App\Services\OrderData;
use App\Services\PaymentEvidence;
use App\Services\StoreStaffAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class InvoiceController extends Controller
{
    private function requireSchema(): void
    {
        abort_unless(Schema::hasTable('order_invoices'), 503, 'Invoice documents await reviewed database setup. Existing order receipts remain available.');
    }

    private function order(Request $request, int $id): Order
    {
        $query = Order::whereKey($id);
        $role = $request->user()->role?->slug;
        if ($role === 'supervisor') {
            $context = app(StoreStaffAccess::class)->resolve($request->user(), ['supervisor']);
            $query->where('store_id', $context['store']->store_id);
        } elseif ($role === 'shopper') {
            abort_unless($request->user()->hasVerifiedEmail(), 403);
            $query->where('shopper_user_id', $request->user()->id);
        } else abort_unless($role === 'admin', 403);
        return $query->lockForUpdate()->firstOrFail();
    }

    public function generate(Request $request, int $order)
    {
        return DB::transaction(function () use ($request, $order) {
            $record = $this->order($request, $order);
            $this->requireSchema();
            $payment = DB::table('order_payments')->where('order_id', $record->order_id)->lockForUpdate()->first();
            $handover = DB::table('order_handovers')->where('order_id', $order)->lockForUpdate()->first();
            abort_unless($record->status === 'completed' && $record->reservation_status === 'fulfilled'
                && $handover && app(PaymentEvidence::class)->valid($record, $payment),
                409, 'Generate the order invoice document after verified payment and completed physical handover.');
            // Current read after the order lock, including MariaDB REPEATABLE READ.
            $invoice = DB::table('order_invoices')->where('order_id', $order)->lockForUpdate()->first();
            if ($invoice) return response()->json(['invoice' => $this->present($invoice), 'message' => 'Existing Draft / Pro Forma document retrieved.']);
            $seller = DB::table('store_invoice_settings')->where('store_id', $record->store_id)->lockForUpdate()->first();
            $reference = 'PF-'.$record->store_id.'-'.Str::ulid();
            $snapshot = [
                'reference' => $reference, 'label' => 'Draft / Pro Forma', 'official_invoice' => false,
                'invoice_date' => now('Asia/Manila')->format('Y-m-d'), 'generated_at' => now()->toIso8601String(),
                'seller' => $seller ? collect($seller)->only(['registered_name', 'registered_address', 'tin', 'branch_code', 'tax_registration', 'numbering_authority'])->all() : null,
                'seller_note' => $seller ? 'Seller details recorded by Admin; official invoicing authorization is not enabled.' : 'Registered seller details and numbering authority have not been confirmed. Store identity below comes from the order.',
                'order' => collect(app(OrderData::class)->present($record))->only([
                    'order_id', 'store_id', 'store_name', 'store_address', 'shopper_name', 'status', 'completed_at',
                    'payment_method', 'payment_status', 'subtotal_centavos', 'service_fee_centavos', 'total_centavos', 'currency', 'items',
                ])->all(),
                'transaction_id' => $payment->id, 'payment_reference' => $payment->provider_reference ?: 'TX-'.$payment->id,
                'tax_note' => 'Tax breakdown is unconfirmed. No VAT, exemption or input-tax entitlement is represented by this draft.',
                'warning' => 'Draft / Pro Forma — Not a BIR-authorized Sales Invoice. Obtain the supermarket’s authorized invoice for tax purposes.',
            ];
            $id = DB::table('order_invoices')->insertGetId(['order_id' => $order, 'store_id' => $record->store_id, 'reference' => $reference,
                'document_type' => 'pro_forma', 'snapshot' => json_encode($snapshot, JSON_THROW_ON_ERROR), 'generated_by_user_id' => $request->user()->id, 'generated_at' => now()]);
            $this->audit($request, $record->store_id, $id, 'generated');
            return response()->json(['invoice' => $snapshot, 'message' => 'Draft / Pro Forma document generated.'], 201);
        }, 3);
    }

    public function show(Request $request, int $order)
    {
        return DB::transaction(function () use ($request, $order) {
            $record = $this->order($request, $order); $this->requireSchema();
            $invoice = DB::table('order_invoices')->where('order_id', $order)->where('store_id', $record->store_id)->first();
            abort_unless($invoice, 404, 'Generate the Draft / Pro Forma document first.');
            return response()->json(['invoice' => $this->present($invoice)]);
        });
    }

    public function pdf(Request $request, int $order, DocumentPdf $pdf)
    {
        $invoice = DB::transaction(function () use ($request, $order) {
            $record = $this->order($request, $order); $this->requireSchema();
            $invoice = DB::table('order_invoices')->where('order_id', $order)->where('store_id', $record->store_id)->first();
            abort_unless($invoice, 404, 'Generate the Draft / Pro Forma document first.');
            $this->audit($request, $record->store_id, $invoice->id, 'pdf_export');
            return $this->present($invoice);
        });
        return $pdf->download($pdf->render('pdf.invoice', ['invoice' => $invoice]), $invoice['reference'].'.pdf');
    }

    public function settings(Request $request, int $store)
    {
        $this->requireSchema(); Store::findOrFail($store);
        return response()->json(['settings' => DB::table('store_invoice_settings')->where('store_id', $store)->first(), 'official_issuance_enabled' => false]);
    }

    public function updateSettings(Request $request, int $store)
    {
        $this->requireSchema();
        $input = $request->validate([
            'registered_name' => ['nullable', 'string', 'max:255'], 'registered_address' => ['nullable', 'string', 'max:500'],
            'tin' => ['nullable', 'string', 'max:30', 'regex:/^[0-9 -]+$/'], 'branch_code' => ['nullable', 'string', 'max:10', 'regex:/^[0-9]+$/'],
            'tax_registration' => ['required', Rule::in(['unconfirmed', 'vat', 'non_vat'])],
            'numbering_authority' => ['nullable', 'string', 'max:255'], 'review_notes' => ['required', 'string', 'max:2000'],
            'official_issuance_enabled' => ['prohibited'], 'updated_by_user_id' => ['prohibited'], 'store_id' => ['prohibited'],
        ]);
        return DB::transaction(function () use ($request, $store, $input) {
            Store::whereKey($store)->lockForUpdate()->firstOrFail();
            $previous = DB::table('store_invoice_settings')->where('store_id', $store)->first();
            DB::table('store_invoice_settings')->updateOrInsert(['store_id' => $store], $input + ['updated_by_user_id' => $request->user()->id,
                'created_at' => $previous?->created_at ?? now(), 'updated_at' => now()]);
            $this->audit($request, $store, null, 'seller_settings_changed', json_encode(['before' => $previous, 'after' => $input]));
            return response()->json(['message' => 'Seller details saved. Documents remain Draft / Pro Forma; official issuance requires separate partner approval and implementation.']);
        });
    }

    private function present(object $invoice): array { return json_decode($invoice->snapshot, true, 512, JSON_THROW_ON_ERROR); }
    private function audit(Request $request, int $store, ?int $invoice, string $action, ?string $details = null): void
    {
        DB::table('invoice_audits')->insert(['store_id' => $store, 'invoice_id' => $invoice, 'actor_user_id' => $request->user()->id,
            'action' => $action, 'details' => $details, 'created_at' => now()]);
    }
}
