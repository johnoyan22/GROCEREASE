import { useRef, useState } from 'react';
import { decideStockReceipt } from '../../../services/api';
import { sellingUnits } from '../../../services/product-units';

function ReceiptDecision({ receipt, onSaved, onFailure }) {
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  async function decide(decision) {
    if (busy.current) return;
    if (decision === 'rejected' && !note.trim()) { setError('Enter a reason for rejection.'); return; }
    busy.current = true; setPending(true); setError('');
    try { const result = await decideStockReceipt(receipt.id, decision, note.trim()); onSaved(result.message); }
    catch (failure) { setError(Object.values(failure.errors ?? {}).flat().join(' ') || failure.message); onFailure(failure); }
    finally { busy.current = false; setPending(false); }
  }
  return <div className="mt-3 border-t pt-3">
    <label className="block text-sm">Reason / decision note (required for rejection)<textarea maxLength="1000" rows="2" disabled={pending} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    <div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={pending} onClick={() => decide('approved')} className="rounded-lg bg-green-700 px-4 py-2 text-sm text-white disabled:opacity-50">Approve addition of {receipt.quantity} {sellingUnits(receipt, receipt.quantity)}</button><button type="button" disabled={pending} onClick={() => decide('rejected')} className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-50">Reject</button></div>
  </div>;
}

export default function StockReceipts({ receipts, supervisor, onSaved, onFailure }) {
  return <section className="space-y-4" aria-label="Stock additions"><h2 className="text-lg font-semibold">Stock additions and decisions</h2>
    <p className="text-sm text-gray-600">Pending and rejected additions leave physical stock unchanged. Each approval creates one batch.</p>
    {!receipts.length && <p className="rounded-xl border bg-white p-5 text-sm text-gray-600">No stock additions submitted.</p>}
    {receipts.map((receipt) => <article key={receipt.id} className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">#{receipt.id} · {receipt.product_name} · {receipt.size || 'No configured size'}</h3><span className="text-sm font-semibold capitalize">{receipt.status}</span></div>
      <p className="mt-2 break-all text-xs text-gray-500">{receipt.sku}</p>
      <p className="mt-3 text-sm">Add {receipt.quantity} {sellingUnits(receipt, receipt.quantity)} · Date Received: {receipt.received_date} · Expiry Date: {receipt.expiry_date || 'Unknown / not applicable'}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm">Description: {receipt.description}</p>
      <p className="mt-2 text-xs text-gray-500">Submitted by User #{receipt.requested_by_user_id} · {new Date(receipt.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>
      {receipt.decided_at && <p className="mt-2 break-words text-xs">{receipt.status} by User #{receipt.decided_by_user_id} · {receipt.decision_note}</p>}
      {supervisor && receipt.status === 'pending' && <ReceiptDecision receipt={receipt} onSaved={onSaved} onFailure={onFailure} />}
    </article>)}
  </section>;
}
