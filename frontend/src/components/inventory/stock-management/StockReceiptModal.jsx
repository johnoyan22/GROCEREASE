import { useRef, useState } from 'react';
import { submitStockReceipt } from '../../../services/api';
import { sellingUnits, manilaToday } from '../../../services/product-units';

export default function StockReceiptModal({ products, onClose, onSaved }) {
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [received, setReceived] = useState(manilaToday);
  const [expiry, setExpiry] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const busy = useRef(false);
  const operation = useRef(crypto.randomUUID());
  const submitted = useRef(null);
  const item = products.find((product) => String(product.store_inventory_id) === itemId);
  const input = 'mt-1 w-full min-w-0 rounded-lg border border-gray-300 bg-white p-2.5 text-sm';

  async function submit(event) {
    event.preventDefault();
    if (busy.current || !item) return;
    busy.current = true; setPending(true); setError('');
    // Preserve the same identity and exact payload across uncertain network responses.
    submitted.current ??= { id: itemId, details: { operation_id: operation.current, quantity: Number(quantity), received_date: received, expiry_date: expiry || null, description: description.trim() } };
    try {
      const result = await submitStockReceipt(submitted.current.id, submitted.current.details);
      onSaved(result.message); onClose();
    } catch (failure) {
      if (failure.status && failure.status < 500) { submitted.current = null; setUncertain(false); }
      else setUncertain(true);
      setError(Object.values(failure.errors ?? {}).flat().join(' ') || failure.message);
    } finally { busy.current = false; setPending(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" onKeyDown={(event) => { if (event.key === 'Escape' && !pending) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="receipt-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
      <h2 id="receipt-title" className="text-lg font-bold">Add Stock</h2>
      <p className="mt-1 text-sm text-gray-600">One product and expiry group per submission. Stock increases after approval.</p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {uncertain && <p className="text-sm text-amber-800">Submission outcome is uncertain. Submit again to safely check the same receipt.</p>}
        <fieldset disabled={pending || uncertain} className="space-y-4">
          <label className="block text-sm">Product<select aria-label="Product" required value={itemId} onChange={(event) => setItemId(event.target.value)} className={input}><option value="">Choose existing product</option>{products.map((product) => <option key={product.store_inventory_id} value={product.store_inventory_id}>{product.product_name} · {product.size || 'Count only / size unconfigured'} · {product.sku} · {product.selling_unit || 'Legacy unit unconfigured'}</option>)}</select></label>
          {item && <p className="text-xs text-gray-600">{item.size || 'No package size'} · {item.sku} · Sold as {item.selling_unit || 'unconfigured legacy unit'}</p>}
          <label className="block text-sm">Quantity to Add ({item ? sellingUnits(item, 2) : 'selling units'})<input required type="number" min="1" max="2147483647" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className={input} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">Date Received<input required type="date" max={manilaToday()} value={received} onChange={(event) => setReceived(event.target.value)} className={input} /></label>
            <label className="block text-sm">Expiry Date<input type="date" min={received} value={expiry} onChange={(event) => setExpiry(event.target.value)} className={input} /><span className="mt-1 block text-xs text-gray-500">Optional — unknown or not applicable</span></label>
          </div>
          <label className="block text-sm">Description<textarea required maxLength="1000" rows="3" placeholder="Delivery from supplier." value={description} onChange={(event) => setDescription(event.target.value)} className={input} /></label>
        </fieldset>
        <div className="flex justify-end gap-3 border-t pt-4">
          <button type="button" disabled={pending} onClick={onClose} className="rounded-lg border px-4 py-2.5 text-sm">Cancel</button>
          <button disabled={pending || !item} className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{pending ? 'Submitting…' : 'Submit for Approval'}</button>
        </div>
      </form>
    </section>
  </div>;
}
