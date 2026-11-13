import { useState } from 'react';
import { generateOrderInvoice, downloadOrderInvoice } from '../../services/api';
const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

export default function InvoiceDocument({ orderId, role }) {
  const [invoice, setInvoice] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function generate() {
    setBusy(true); setError('');
    try { setInvoice((await generateOrderInvoice(orderId, role)).invoice); } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  async function download() {
    setBusy(true); setError('');
    try { await downloadOrderInvoice(orderId, role); } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <section className="mt-4"><button type="button" disabled={busy} onClick={generate} className="rounded-lg border border-green-800 px-4 py-2 text-sm text-green-800">{busy ? 'Loading document…' : 'View invoice draft'}</button>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {invoice && <div className="mt-3 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><h3 className="font-semibold">Sales Invoice — Draft / Pro Forma</h3><p className="break-all">{invoice.reference} · {invoice.invoice_date}</p><p>{invoice.seller?.registered_name || invoice.order.store_name}</p><p>{invoice.seller_note}</p><p>Shopper: {invoice.order.shopper_name} · Total: {money.format(invoice.order.total_centavos / 100)}</p><p>{invoice.tax_note}</p><p className="font-semibold text-amber-900">{invoice.warning}</p><div className="flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={download} className="rounded-lg bg-green-800 px-4 py-2 text-white">Download printable PDF</button><button type="button" onClick={() => setInvoice(null)} className="rounded-lg border bg-white px-4 py-2">Close draft</button></div></div>}
  </section>;
}
