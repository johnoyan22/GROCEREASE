import { useEffect, useRef, useState } from 'react';
import { getInventoryBatches } from '../../../services/api';
import { sellingUnits } from '../../../services/product-units';
import { StockPolicyForm } from '../stock-management/StockForms';

const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const statusLabels = { active: 'Active', on_hold: 'On hold', expired: 'Expired', depleted: 'Empty' };

export default function ProductDetailsModal({ product, supervisor, onClose, onSaved }) {
  const [request, setRequest] = useState({ page: 1, includeEmpty: false, revision: 0 });
  const [response, setResponse] = useState({ key: '', data: null, error: '' });
  const dialog = useRef(null);
  const closeButton = useRef(null);
  const content = useRef(null);
  const pager = useRef(null);
  const inventoryId = product.store_inventory_id;
  const storeId = product.store_id;
  const key = `${storeId}:${inventoryId}:${request.page}:${request.includeEmpty}:${request.revision}`;
  const loading = response.key !== key;
  const data = loading ? null : response.data;
  const error = loading ? '' : response.error;
  const pagination = data?.pagination;

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);

  useEffect(() => {
    const escape = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [onClose]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getInventoryBatches(inventoryId, { page: request.page, includeEmpty: request.includeEmpty, signal: controller.signal })
      .then((result) => {
        const meta = result.pagination;
        if (result.store_inventory_id !== inventoryId || result.store?.store_id !== storeId
          || !Array.isArray(result.batches) || result.batches.length > 5 || meta?.per_page !== 5
          || !Number.isInteger(meta.total) || meta.total < 0 || !Number.isInteger(meta.current_page)
          || !Number.isInteger(meta.last_page) || meta.current_page < 1 || meta.current_page > meta.last_page) {
          throw new Error('Unexpected batch response. Please retry.');
        }
        if (active) setResponse({ key, data: result, error: '' });
      })
      .catch((failure) => {
        if (active && failure.name !== 'AbortError') setResponse({ key, data: null, error: failure.message || 'Could not load stock batches.' });
      });
    return () => { active = false; controller.abort(); };
  }, [inventoryId, storeId, request.page, request.includeEmpty, request.revision, key]);

  function navigate(page) {
    // The clicked navigation button becomes disabled during loading. Keep keyboard
    // focus in the modal rather than letting the browser move it to the page body.
    pager.current?.focus({ preventScroll: true });
    content.current?.scrollTo({ top: 0 });
    setRequest((current) => ({ ...current, page, revision: current.revision + 1 }));
  }

  function handleKey(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [href], [tabindex="0"]')]
      .filter((element) => element.getClientRects().length > 0);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || !dialog.current.contains(document.activeElement))) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus();
    }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="product-details-title" onKeyDown={handleKey} className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
        <div className="min-w-0"><h2 id="product-details-title" className="text-lg font-bold">{product.product_name} · {product.size || 'No configured size'}</h2><p className="mt-1 break-all text-xs text-gray-500">{product.sku}</p></div>
        <button ref={closeButton} type="button" onClick={onClose} className="shrink-0 rounded-lg border px-3 py-2 text-sm">Close</button>
      </header>
      <div ref={content} className="min-h-0 overflow-y-auto px-5 py-4">
        <p className="text-sm">{product.category} · {money.format(product.selling_price)} per {product.selling_unit || 'legacy selling unit (unconfigured)'}</p>
        <p className="mt-2 text-sm">Physical: {product.hard_stock_qty} · Available: {product.available_stock} · Reserved: {product.soft_stock_qty} {sellingUnits(product, product.soft_stock_qty)}</p>
        <p className="mt-2 text-xs text-gray-600">Maximum per order: {product.max_per_order ?? 'Not configured'} · Manufacturer barcode: {product.barcode || 'Not recorded'}</p>
        <div className="mb-3 mt-5 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Stock Batches</h3>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={request.includeEmpty} onChange={(event) => {
            const includeEmpty = event.target.checked;
            content.current?.scrollTo({ top: 0 });
            setRequest((current) => ({ ...current, page: 1, includeEmpty, revision: current.revision + 1 }));
          }} />Include empty batches</label>
        </div>
        {loading && <p role="status" className="py-6 text-sm text-gray-600">Loading stock batches…</p>}
        {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800"><p>{error}</p><button type="button" onClick={() => navigate(request.page)} className="mt-2 rounded-lg border border-red-300 px-3 py-2">Retry batches</button></div>}
        {data && <>
          <div className="overflow-x-auto"><table className="w-full min-w-[590px] text-left text-xs">
            <thead className="bg-gray-50"><tr>{['Batch No.', 'Remaining Stock', 'Date Received', 'Expiry Date', 'Status'].map((label) => <th key={label} scope="col" className="p-2 font-medium">{label}</th>)}</tr></thead>
            <tbody>{data.batches.map((batch) => <tr key={batch.id} className="border-t align-top">
              <td className="p-2"><span className="font-medium">{batch.batch_no || batch.reference}</span><details className="mt-2"><summary className="cursor-pointer">Batch details</summary>
                <p className="mt-1">Received stock: {batch.quantity_received} {sellingUnits(product, batch.quantity_received)}</p>
                <p className="mt-1 whitespace-pre-wrap break-words">{batch.description || 'No description recorded'}</p>
                {batch.reference && batch.reference !== batch.batch_no && <p className="mt-1 break-all text-gray-500">Saved reference: {batch.reference}</p>}
              </details></td>
              <td className="p-2">{batch.remaining_quantity} {sellingUnits(product, batch.remaining_quantity)}</td>
              <td className="p-2">{batch.received_date || 'Unknown'}</td><td className="p-2">{batch.expiry_date || 'Unknown / not applicable'}</td>
              <td className={'p-2 ' + (batch.status === 'expired' ? 'text-red-700' : batch.status === 'on_hold' ? 'text-amber-800' : '')}>{statusLabels[batch.status] || batch.status}</td>
            </tr>)}</tbody>
          </table></div>
          {pagination.total === 0 && <p className="py-6 text-sm text-gray-600">{request.includeEmpty ? 'No stock batches recorded.' : 'No batches with remaining stock. Include empty batches to see earlier receipts.'}</p>}
        </>}
        {supervisor && <StockPolicyForm item={product} onSaved={onSaved} onFailure={() => {}} />}
      </div>
      <footer ref={pager} tabIndex={-1} className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-white px-5 py-3">
        <div aria-live="polite" className="text-xs text-gray-600">
          {pagination ? <><p>{pagination.total ? `Showing ${pagination.from}–${pagination.to} of ${pagination.total} batches` : 'Showing 0 of 0 batches'}</p><p className="mt-1">Page {pagination.current_page} of {pagination.last_page}</p></> : <p>{loading ? 'Loading batches…' : 'Batch list unavailable'}</p>}
        </div>
        <nav aria-label="Batch pages" className="flex gap-2">
          <button type="button" disabled={!pagination || pagination.current_page <= 1} onClick={() => navigate(pagination.current_page - 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Previous</button>
          <button type="button" disabled={!pagination || pagination.current_page >= pagination.last_page} onClick={() => navigate(pagination.current_page + 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Next</button>
        </nav>
      </footer>
    </section>
  </div>;
}
