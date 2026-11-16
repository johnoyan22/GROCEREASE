import { useEffect, useRef, useState } from 'react';
import { submitStockAdjustment } from '../../../services/api';
import { sellingUnits } from '../../../services/product-units';

export default function BatchCountModal({ batch, onClose, onSaved }) {
  const [count, setCount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [retry, setRetry] = useState(false);
  const saving = useRef(false);
  const attempt = useRef(null);
  const dialog = useRef(null);
  const close = useRef(null);
  const valid = /^\d+$/.test(count) && Number(count) <= 2147483647 && Number(count) !== batch.remaining_quantity;
  const delta = Number(count) - batch.remaining_quantity;
  const units = (quantity) => sellingUnits(batch, quantity);

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    close.current?.focus();
    return () => { document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);

  function keyboard(event) {
    if (event.key === 'Escape') { event.preventDefault(); if (!saving.current) onClose(); }
    if (event.key !== 'Tab') return;
    const items = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)')];
    if (!items.length) { event.preventDefault(); dialog.current.focus(); return; }
    if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
    if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
  }

  async function submit(event) {
    event.preventDefault();
    if (saving.current) return;
    if (!valid || !reason.trim()) { setError('Enter a different whole remaining count (zero is allowed) and a reason.'); return; }
    dialog.current?.focus();
    saving.current = true; setPending(true); setError('');
    attempt.current ??= { operation_id: crypto.randomUUID(), inventory_batch_id: batch.id,
      requested_remaining_quantity: Number(count), expected_stock_version: batch.stock_version, reason: reason.trim() };
    try {
      const result = await submitStockAdjustment(batch.store_inventory_id, attempt.current);
      onSaved(result.message);
    } catch (failure) {
      const uncertain = !failure.status || failure.status >= 500;
      setRetry(uncertain);
      setError(failure.message + (uncertain ? ' Retry to check the same submission; its count and reason have been kept.' : ''));
      if (!uncertain) attempt.current = null;
    } finally { saving.current = false; setPending(false); }
  }

  const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm';
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
    <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="batch-count-title" onKeyDown={keyboard} className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
      <header className="flex items-center justify-between gap-3 border-b p-4"><h2 id="batch-count-title" className="text-lg font-bold">Update Count · {batch.batch_no}</h2><button ref={close} type="button" disabled={pending} onClick={onClose} className="rounded-lg border px-3 py-2 text-sm">Close</button></header>
      <form onSubmit={submit} className="min-h-0 overflow-y-auto p-4">
        <p className="font-semibold">{batch.product_name} {batch.size}</p><p className="mt-1 break-all text-sm text-gray-600">SKU: {batch.sku} · Sold as: {batch.selling_unit || 'Legacy unit unconfigured'}</p>
        <p className="mt-3 text-sm">Date Received: {batch.received_date || 'Unknown'}<br />Expiry Date: {batch.expiry_date || 'Unknown / not applicable'}</p>
        <p className="mt-3 text-sm">Recorded batch remaining: <strong>{batch.remaining_quantity} {units(batch.remaining_quantity)}</strong><br />Currently reserved / allocated: <strong>{batch.allocated_quantity} {units(batch.allocated_quantity)}</strong></p>
        <fieldset disabled={pending || retry} className="mt-4 space-y-4">
          <label className="block text-sm">Actual Remaining Count<input autoComplete="off" required type="number" min="0" max="2147483647" step="1" value={count} onChange={(event) => setCount(event.target.value)} className={inputClass} /></label>
          <label className="block text-sm">Reason for Correction<textarea required maxLength="1000" rows="3" value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass} /></label>
        </fieldset>
        {count !== '' && <p role="status" className="mt-4 rounded-lg bg-gray-50 p-3 text-sm">Recorded: {batch.remaining_quantity} {units(batch.remaining_quantity)}; Actual: {count} {units(count)}; Change: {delta > 0 ? '+' : ''}{delta} {units(delta)}.</p>}
        {valid && Number(count) < batch.allocated_quantity && <p className="mt-3 text-sm text-amber-800">Reconciliation required. You can record this discrepancy for review. Approval is blocked while it conflicts with reserved stock; orders and allocations stay unchanged.</p>}
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-3"><button type="button" disabled={pending} onClick={onClose} className="rounded-lg border px-4 py-2.5 text-sm">Cancel</button><button disabled={pending || !valid || !reason.trim()} className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{pending ? 'Submitting…' : retry ? 'Retry Submission' : 'Submit for Approval'}</button></div>
      </form>
    </section>
  </div>;
}
