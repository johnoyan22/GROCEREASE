import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import useStoreStock from '../../../hooks/useStoreStock';
import StoreSelector from '../layout/StoreSelector';
import ProductTable from '../product-management/ProductTable';
import InventoryLoadState from '../shared/InventoryLoadState';
import { LowStockReportForm, StockDecisionForm, StockPolicyForm } from './StockForms';
import StockReceipts from './StockReceipts';
import { sellingUnits } from '../../../services/product-units';

function recordedAt(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-PH');
}

export default function StockWorkspace({ title, initialView, supervisor = false, requestSection, onRequestSectionChange }) {
  const stock = useStoreStock();
  const location = useLocation();
  const [localView, setView] = useState(initialView);
  const tracking = !supervisor && ['addition', 'correction'].includes(requestSection);
  const view = tracking ? (requestSection === 'addition' ? 'receipts' : 'requests') : localView;
  // URL navigation (including Back) starts a fresh filter scope for the tracker.
  // Supervisor and other shared screens retain their existing local filter state.
  const filterKey = tracking ? location.key + ':' + requestSection : 'workspace';
  const [filters, setFilters] = useState({ key: filterKey, search: '', status: '' });
  const search = filters.key === filterKey ? filters.search : '';
  const status = filters.key === filterKey ? filters.status : '';
  function setFilter(name, value) {
    setFilters({ key: filterKey, search, status, [name]: value });
  }
  function selectRequestSection(section) {
    if (section === requestSection) return;
    setFilters({ key: '', search: '', status: '' });
    onRequestSectionChange(section);
  }
  const [policyItemId, setPolicyItemId] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeIsError, setNoticeIsError] = useState(false);
  const policyItem = stock.inventory.find(function (item) { return String(item.store_inventory_id) === policyItemId; });
  const lowStock = stock.inventory.filter(function (item) { return item.is_low_stock; });
  const adjustments = stock.adjustments.filter(function (row) {
    const text = [row.id, row.batch_no, row.product_name, row.sku, row.reason, row.requested_by_name].join(' ').toLowerCase();
    return text.includes(search.toLowerCase()) && (!status || row.status === status);
  });

  function saved(message) {
    setNotice(message);
    setNoticeIsError(false);
    stock.reload();
  }

  function failed(error) {
    if ([401, 403, 404, 409].includes(error.status)) {
      setNotice(error.message);
      setNoticeIsError(true);
      stock.reload();
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">{title}</h1><p className="mt-1 text-sm text-gray-600">{tracking ? 'Track stock additions and batch count corrections for your assigned store.' : 'Physical stock includes reservations. Available stock excludes reservations, expired and on-hold batches.'}</p></div>
        <StoreSelector store={stock.store} loading={stock.loading} error={stock.error} />
      </div>
      {notice && <p role={noticeIsError ? 'alert' : 'status'} className={'mb-4 rounded-lg border p-3 text-sm ' + (noticeIsError ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800')}>{notice}</p>}
      <InventoryLoadState loading={stock.loading} error={stock.error} onRetry={stock.reload} />
      {!stock.loading && !stock.error && stock.store && (
        <>
          <div className="mb-5 flex flex-wrap gap-3">
            {tracking ? <div role="group" aria-label="Stock request sections" className="flex gap-2">
              {[['addition', 'Stock Addition', 'stock-addition-panel'], ['correction', 'Stock Correction', 'stock-correction-panel']].map(([section, label, panel]) => <button key={section} type="button" aria-pressed={requestSection === section} aria-controls={panel} onClick={() => selectRequestSection(section)} className={'rounded-lg border px-4 py-2 text-sm font-medium ' + (requestSection === section ? 'border-green-700 bg-green-700 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50')}>{label}</button>)}
            </div> : <>
            <button type="button" aria-pressed={view === 'receipts'} onClick={() => setView('receipts')} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">Stock additions ({stock.receipts.filter((row) => row.status === 'pending').length} pending)</button>
            {supervisor && <>
              <button type="button" aria-pressed={view === 'requests'} onClick={function () { setView('requests'); }} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">Corrections ({stock.adjustments.filter(function (row) { return row.status === 'pending'; }).length} pending)</button>
              <button type="button" aria-pressed={view === 'low'} onClick={function () { setView('low'); }} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">Low stock ({lowStock.length})</button>
              <button type="button" aria-pressed={view === 'policies'} onClick={function () { setView('policies'); }} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">Re-order Levels & order limits</button>
              <button type="button" aria-pressed={view === 'activity'} onClick={function () { setView('activity'); }} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">Availability history</button>
            </>}
            </>}
            <button type="button" onClick={stock.reload} className="rounded-lg border border-green-700 bg-white px-4 py-2 text-sm text-green-800">Refresh</button>
          </div>
          {view === 'receipts' && <div id="stock-addition-panel"><StockReceipts receipts={stock.receipts} supervisor={supervisor} onSaved={saved} onFailure={failed} /></div>}
          {(view === 'requests' || view === 'submit') && (
            <section id="stock-correction-panel" className="mt-5 space-y-4" aria-label="Stock correction requests">
              <h2 className="text-lg font-semibold">Correction requests and decisions</h2>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input type="search" aria-label="Search correction requests" value={search} onChange={function (event) { setFilter('search', event.target.value); }} placeholder="Search product, batch, requester, or reason..." className="flex-1 rounded-lg border border-gray-300 bg-white p-2.5 text-sm" />
                <select aria-label="Correction status" value={status} onChange={function (event) { setFilter('status', event.target.value); }} className="rounded-lg border border-gray-300 bg-white p-2.5 text-sm"><option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>
              </div>
              {adjustments.length === 0 && <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600">No matching correction requests.</p>}
              {adjustments.map(function (row) {
                return <article key={row.id} className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">#{row.id} · {row.product_name} ({row.sku})</h3><span className="rounded bg-gray-100 px-3 py-1 text-sm font-semibold capitalize">{row.status}</span></div>
                  {row.is_legacy ? <>
                    <p className="mt-3 text-sm font-medium text-amber-800">Historical whole-product correction</p>
                    <p className="mt-1 text-sm">Observed physical: {row.observed_hard_stock_qty} · Observed reserved: {row.observed_soft_stock_qty} · Requested physical: {row.requested_hard_stock_qty}</p>
                  </> : <>
                    <p className="mt-3 text-sm font-semibold">{row.batch_no} · {row.stock_condition?.replaceAll('_', ' ')}</p>
                    <p className="mt-1 text-sm">Date Received: {row.received_date || 'Unknown'} · Expiry Date: {row.expiry_date || 'Unknown / not applicable'}</p>
                    <p className="mt-2 text-sm">Recorded remaining: {row.observed_remaining_quantity} {sellingUnits(row, row.observed_remaining_quantity)} · Requested: <strong>{row.requested_remaining_quantity} {sellingUnits(row, row.requested_remaining_quantity)}</strong> · Change: {row.quantity_change > 0 ? '+' : ''}{row.quantity_change} {sellingUnits(row, Math.abs(row.quantity_change))}</p>
                    <p className="mt-1 text-sm text-gray-600">Current batch remaining: {row.current_remaining_quantity} · Currently allocated: {row.current_allocated_quantity} · Allocated at submission: {row.observed_allocated_quantity}</p>
                  </>}
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm">Reason: {row.reason}</p>
                  <p className="mt-2 text-xs text-gray-500">Submitted by {row.requested_by_name} · {recordedAt(row.created_at)}</p>
                  {row.decided_at && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-700">{row.status} by {row.decided_by_name} · {recordedAt(row.decided_at)}. {row.decision_note}</p>}
                  {!supervisor && row.is_stale && <p className="mt-3 text-sm text-amber-800">Stock changed after submission. Ask your Supervisor to reject this request, then submit a fresh count.</p>}
                  {!supervisor && row.status === 'pending' && row.reconciliation_required && <p className="mt-3 text-sm text-amber-800">Reconciliation required: this count conflicts with reserved stock. Approval is blocked; orders and reservations remain unchanged.</p>}
                  {supervisor && row.status === 'pending' && <StockDecisionForm adjustment={row} onSaved={saved} onFailure={failed} />}
                </article>;
              })}
            </section>
          )}
          {view === 'low' && (
            <section className="space-y-5">
              <div><h2 className="mb-2 text-lg font-semibold">Products at or below their Re-order Level</h2><p className="mb-3 text-sm text-gray-600">Products without a configured Re-order Level are not flagged. Your Supervisor manages Re-order Levels.</p><ProductTable products={lowStock} /></div>
              {!supervisor && <LowStockReportForm inventory={stock.inventory} onSaved={saved} onFailure={failed} />}
              <h2 className="text-lg font-semibold">Low-stock report history ({stock.reports.length})</h2>
              {stock.reports.length === 0 && <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600">No low-stock reports recorded for this store.</p>}
              {stock.reports.map(function (row) {
                return <article key={row.id} className="rounded-xl border border-gray-200 bg-white p-5"><h3 className="font-semibold">#{row.id} · {row.product_name} ({row.sku})</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm">{row.note}</p><p className="mt-3 text-sm text-gray-600">Physical at report: {row.observed_hard_stock_qty} · Reserved at report: {row.observed_soft_stock_qty} · Available at report: {row.observed_hard_stock_qty - row.observed_soft_stock_qty}</p><p className="mt-2 text-xs text-gray-500">{row.reported_by_name} · {recordedAt(row.created_at)}</p></article>;
              })}
            </section>
          )}
          {view === 'policies' && supervisor && (
            <section>
              <h2 className="text-lg font-semibold">Store product policies</h2>
              <label className="mt-4 block text-sm">Product<select value={policyItemId} onChange={function (event) { setPolicyItemId(event.target.value); }} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5"><option value="">Select a store product</option>{stock.inventory.map(function (item) { return <option key={item.store_inventory_id} value={item.store_inventory_id}>{item.product_name} ({item.sku})</option>; })}</select></label>
              {policyItem && <StockPolicyForm key={policyItem.store_inventory_id + ':' + policyItem.updated_at} item={policyItem} onSaved={saved} onFailure={failed} />}
            </section>
          )}
          {view === 'activity' && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Availability changes ({stock.history.length})</h2>
              <p className="mb-4 text-sm text-gray-600">This history starts when stock auditing is enabled. Correction requests and decisions are recorded separately.</p>
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-gray-50"><tr>{['When', 'Product', 'Previous status', 'New status', 'Changed by'].map(function (label) { return <th key={label} scope="col" className="p-3">{label}</th>; })}</tr></thead><tbody>{stock.history.map(function (row) { return <tr key={row.id} className="border-t border-gray-100"><td className="p-3">{recordedAt(row.created_at)}</td><td className="p-3">{row.product_name} · {row.sku}</td><td className="p-3">{row.previous_status ?? 'New product'}</td><td className="p-3">{row.new_status}</td><td className="p-3">{row.changed_by_name}</td></tr>; })}</tbody></table>{stock.history.length === 0 && <p className="p-5 text-sm text-gray-600">No availability changes recorded yet.</p>}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
