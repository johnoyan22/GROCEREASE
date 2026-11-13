import { useState } from 'react';
import { lookupOrderReference } from '../../services/api';

export default function OrderReferenceLookup({ onFound }) {
  const [reference, setReference] = useState(''), [result, setResult] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function search(e) {
    e.preventDefault(); setBusy(true); setError(''); setResult(null);
    try { setResult(await lookupOrderReference(reference.trim())); } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <section className="mb-5 rounded-xl border border-green-200 bg-white p-4"><h2 className="font-semibold">Find an order for claiming</h2><form onSubmit={search} className="mt-3 flex flex-col gap-3 sm:flex-row"><label className="flex-1 text-sm">Order ID or reference<input required maxLength={100} value={reference} onChange={e => setReference(e.target.value)} placeholder="Order ID, GE-123, receipt GE-123-4 or TX-56" className="mt-1 w-full rounded-lg border p-2.5" /></label><button disabled={busy} className="self-end rounded-lg bg-green-800 px-4 py-2.5 text-sm text-white">{busy ? 'Searching…' : 'Find reference'}</button></form>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {result && <div className="mt-4 space-y-2 text-sm"><h3 className="font-semibold">{result.order.order_reference || `Order #${result.order.order_id}`} · {result.order.shopper_name}</h3><p>Pickup: {result.order.pickup_window_start_at ? new Date(result.order.pickup_window_start_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : 'Not scheduled'} (Philippine time)</p><p>Payment: {result.order.payment_status} · Preparation: {result.order.status.replaceAll('_', ' ')} · Claim: {result.order.claim_status.replaceAll('_', ' ')}</p><p role="status" className="rounded-lg bg-amber-50 p-3 text-amber-900">{result.notice}</p><button type="button" onClick={() => onFound(result.order.order_id)} className="rounded-lg border px-4 py-2 text-sm">Show order and permitted actions</button></div>}
  </section>;
}
