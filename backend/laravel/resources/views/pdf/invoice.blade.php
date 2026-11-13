<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
@page { margin: 42px 38px 48px; } body { font-family: 'DejaVu Sans', sans-serif; font-size: 10px; color: #1e293b; }
h1 { color: #14532d; font-size: 22px; margin: 0 0 6px; } h2 { font-size: 14px; } p { line-height: 1.5; }
.draft { color: #92400e; background: #fffbeb; padding: 10px; border: 1px solid #fde68a; font-weight: bold; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 18px; } thead { display: table-header-group; }
th { background: #f0fdf4; text-align: left; } th, td { padding: 9px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; word-wrap: break-word; }
tr { page-break-inside: avoid; } .money { text-align: right; white-space: nowrap; } .note { color: #475569; font-size: 9px; }
footer { position: fixed; bottom: -26px; font-size: 8px; color: #92400e; }
</style></head><body>
<footer>Draft / Pro Forma • Not a BIR-authorized Sales Invoice</footer>
<h1>Sales Invoice</h1><div class="draft">Draft / Pro Forma — Not an official tax invoice</div>
<p>Reference: {{ $invoice['reference'] }}<br>Invoice date: {{ $invoice['invoice_date'] }} (Asia/Manila)</p>
<h2>{{ $invoice['seller']['registered_name'] ?? $invoice['order']['store_name'] }}</h2>
<p>{{ $invoice['seller']['registered_address'] ?? $invoice['order']['store_address'] }}<br>
Registered TIN: {{ $invoice['seller']['tin'] ?? 'Not confirmed' }} • Branch: {{ $invoice['seller']['branch_code'] ?? 'Not confirmed' }}<br>
Registration: {{ $invoice['seller']['tax_registration'] ?? 'Unconfirmed' }} • Numbering authority: {{ $invoice['seller']['numbering_authority'] ?? 'Not confirmed' }}</p>
<p class="note">{{ $invoice['seller_note'] }}</p>
<p>Buyer / Shopper: {{ $invoice['order']['shopper_name'] }}<br>Order #{{ $invoice['order']['order_id'] }} • Transaction #{{ $invoice['transaction_id'] }}<br>
Payment: {{ $invoice['order']['payment_method'] }} / {{ $invoice['order']['payment_status'] }} • Reference: {{ $invoice['payment_reference'] }}</p>
<table><thead><tr><th style="width:43%">Product description</th><th style="width:16%">Qty / unit</th><th class="money" style="width:18%">Unit price</th><th class="money" style="width:23%">Line total</th></tr></thead><tbody>
@foreach ($invoice['order']['items'] as $item)
<tr><td>{{ $item['product_name'] }} {{ $item['size'] }}<br><span class="note">{{ $item['sku'] }}</span></td><td>{{ $item['quantity'] }} {{ $item['selling_unit'] ?? '(unit unspecified)' }}</td><td class="money">₱{{ number_format($item['unit_price_centavos'] / 100, 2) }}</td><td class="money">₱{{ number_format($item['line_total_centavos'] / 100, 2) }}</td></tr>
@endforeach
</tbody></table>
<p class="money">Groceries: ₱{{ number_format($invoice['order']['subtotal_centavos'] / 100, 2) }}<br>Service fee: ₱{{ number_format($invoice['order']['service_fee_centavos'] / 100, 2) }}</p>
<h2 class="money">Total: ₱{{ number_format($invoice['order']['total_centavos'] / 100, 2) }}</h2>
<p class="note">{{ $invoice['tax_note'] }} Prices and descriptions are the historical order snapshots.</p>
<p class="draft">{{ $invoice['warning'] }}</p>
</body></html>
