import { useRef, useState } from 'react';
import { decideStockAdjustment, submitLowStockReport, updateInventoryPolicy } from '../../../services/api';

const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm';
const buttonClass = 'rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50';

export function LowStockReportForm({ inventory, onSaved, onFailure }) {
  const [itemId, setItemId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const saving = useRef(false);

  async function submit(event) {
    event.preventDefault();
    if (saving.current || !itemId) return;
    saving.current = true;
    setPending(true);
    setError('');
    try {
      const result = await submitLowStockReport(itemId, note.trim());
      onSaved(result.message);
    } catch (failure) {
      setError(failure.message);
      onFailure(failure);
    } finally {
      saving.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="font-semibold">Report low stock</h2>
      <p className="mt-2 text-sm text-gray-600">Send a report to your store's Supervisor. This does not change quantities or require approval.</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <fieldset disabled={pending} className="mt-4 space-y-4">
        <label className="block text-sm">Product<select required value={itemId} onChange={function (event) { setItemId(event.target.value); }} className={inputClass}>
          <option value="">Select a store product</option>
          {inventory.map(function (row) { return <option key={row.store_inventory_id} value={row.store_inventory_id}>{row.product_name} ({row.sku})</option>; })}
        </select></label>
        <label className="block text-sm">Observation<textarea required maxLength="1000" rows="3" value={note} onChange={function (event) { setNote(event.target.value); }} className={inputClass} /></label>
        <button disabled={pending || !itemId} className={buttonClass}>{pending ? 'Sending...' : 'Send low-stock report'}</button>
      </fieldset>
    </form>
  );
}

export function StockDecisionForm({ adjustment, onSaved, onFailure }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const saving = useRef(false);

  async function decide(decision) {
    if (saving.current) return;
    if (decision === 'rejected' && !note.trim()) {
      setError('Enter a reason for rejecting this request.');
      return;
    }
    saving.current = true;
    setPending(true);
    setError('');
    try {
      const result = await decideStockAdjustment(adjustment.id, decision, note.trim());
      onSaved(result.message);
    } catch (failure) {
      setError(failure.message);
      onFailure(failure);
    } finally {
      saving.current = false;
      setPending(false);
    }
  }

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      {adjustment.is_legacy && <p className="mb-3 text-sm text-amber-800">Historical whole-product request. Reject and ask for a batch-specific count.</p>}
      {adjustment.reconciliation_required && <p role="alert" className="mb-3 text-sm text-red-800">Reconciliation required: actual count conflicts with reserved stock. Orders and reservations remain unchanged.</p>}
      {adjustment.is_stale && <p className="mb-3 text-sm text-amber-800">Stock changed since submission. Reject this request and ask for a fresh count.</p>}
      <label className="block text-sm">Decision note (required for rejection)<textarea disabled={pending} maxLength="1000" rows="2" value={note} onChange={function (event) { setNote(event.target.value); }} className={inputClass} /></label>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      <div className="mt-3 flex gap-3">
        <button type="button" disabled={pending || adjustment.is_stale || adjustment.is_legacy || adjustment.reconciliation_required} onClick={function () { decide('approved'); }} className={buttonClass}>Approve count {adjustment.requested_remaining_quantity ?? adjustment.requested_hard_stock_qty}</button>
        <button type="button" disabled={pending} onClick={function () { decide('rejected'); }} className="rounded-lg border border-red-300 px-4 py-2.5 text-sm text-red-700 disabled:opacity-50">Reject</button>
      </div>
    </div>
  );
}

export function StockPolicyForm({ item, onSaved, onFailure }) {
  const [limit, setLimit] = useState(item.max_per_order ?? '');
  const [threshold, setThreshold] = useState(item.low_stock_threshold ?? '');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const saving = useRef(false);

  async function submit(event) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true;
    setPending(true);
    setError('');
    try {
      let maxPerOrder = null;
      let lowStockThreshold = null;
      if (limit !== '') maxPerOrder = Number(limit);
      if (threshold !== '') lowStockThreshold = Number(threshold);
      const result = await updateInventoryPolicy(item.store_inventory_id, {
        max_per_order: maxPerOrder, low_stock_threshold: lowStockThreshold,
      });
      onSaved(result.message);
    } catch (failure) {
      setError(failure.message);
      onFailure(failure);
    } finally {
      saving.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="font-semibold">{item.product_name} · {item.sku}</h3>
      <p className="mt-2 text-sm text-gray-600">Available: {item.available_stock}. Leave a field blank to remove that setting. Stock quantities remain unchanged.</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <fieldset disabled={pending} className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm">Maximum units per order<input type="number" min="1" max="2147483647" step="1" value={limit} onChange={function (event) { setLimit(event.target.value); }} className={inputClass} /></label>
        <label className="text-sm">Re-order Level ({item.selling_unit ? item.selling_unit + 's' : 'selling units'})<input type="number" min="0" max="2147483647" step="1" value={threshold} onChange={function (event) { setThreshold(event.target.value); }} className={inputClass} /></label>
        <div><button disabled={pending} className={buttonClass}>{pending ? 'Saving...' : 'Save product policy'}</button></div>
      </fieldset>
    </form>
  );
}
