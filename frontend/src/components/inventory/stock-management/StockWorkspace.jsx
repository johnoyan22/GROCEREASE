import { useState } from 'react';
import useStoreStock from '../../../hooks/useStoreStock';
import StoreSelector from '../layout/StoreSelector';
import ProductTable from '../product-management/ProductTable';
import InventoryLoadState from '../shared/InventoryLoadState';
import { LowStockReportForm, StockAdjustmentForm, StockDecisionForm, StockPolicyForm } from './StockForms';

function recordedAt(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-PH');
}

export default function StockWorkspace({ title, initialView, supervisor = false }) {
  const stock = useStoreStock();
  const [view, setView] = useState(initialView);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [policyItemId, setPolicyItemId] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeIsError, setNoticeIsError] = useState(false);
  const policyItem = stock.inventory.find(function (item) { return String(item.store_inventory_id) === policyItemId; });
  const lowStock = stock.inventory.filter(function (item) { return item.is_low_stock; });
  const adjustments = stock.adjustments.filter(function (row) {
    const text = [row.id, row.product_name, row.sku, row.reason, row.requested_by_name].join(' ').toLowerCase();
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
        <div><h1 className="text-2xl font-bold text-gray-900">{title}</h1><p className="mt-1 text-sm text-gray-600">Physical stock includes reservations. Available stock = physical stock − reserved stock.</p></div>
        <StoreSelector store={stock.store} loading={stock.loading} error={stock.error} />
      </div>
      {notice && <p role={noticeIsError ? 'alert' : 'status'} className={'mb-4 rounded-lg border p-3 text-sm ' + (noticeIsError ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800')}>{notice}</p>}
      <InventoryLoadState loading={stock.loading} error={stock.error} onRetry={stock.reload} />
      {!stock.loading && !stock.error && stock.store && (
        <>
          <div className="mb-5 flex flex-wrap gap-3">
            {supervisor && <>
              <button type="button" aria-pressed={view === 'requests'} onClick={function () { setView('requests'); }} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">Corrections ({stock.adjustments.filter(function (row) { return row.status === 'pending'; }).length} pending)</button>
              <button type="button" aria-pressed={view === 'low'} onClick={function () { setView('low'); }} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">Low stock ({lowStock.length})</button>
              <button type="button" aria-pressed={view === 'policies'} onClick={function () { setView('policies'); }} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">Quantity limits & thresholds</button>
              <button type="button" aria-pressed={view === 'activity'} onClick={function () { setView('activity'); }} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">Availability history</button>
            </>}
            <button type="button" onClick={stock.reload} className="rounded-lg border border-green-700 bg-white px-4 py-2 text-sm text-green-800">Refresh</button>
          </div>
          {view === 'submit' && <StockAdjustmentForm inventory={stock.inventory} onSaved={saved} onFailure={failed} />}
          {(view === 'requests' || view === 'submit') && (
            <section className="mt-5 space-y-4" aria-label="Stock correction requests">
              <h2 className="text-lg font-semibold">Correction requests and decisions</h2>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input type="search" aria-label="Search correction requests" value={search} onChange={function (event) { setSearch(event.target.value); }} placeholder="Search product, requester, or reason..." className="flex-1 rounded-lg border border-gray-300 bg-white p-2.5 text-sm" />
                <select aria-label="Correction status" value={status} onChange={function (event) { setStatus(event.target.value); }} className="rounded-lg border border-gray-300 bg-white p-2.5 text-sm"><option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>
              </div>
              {adjustments.length === 0 && <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600">No matching correction requests.</p>}
              {adjustments.map(function (row) {
                return <article key={row.id} className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">#{row.id} · {row.product_name} ({row.sku})</h3><span className="rounded bg-gray-100 px-3 py-1 text-sm font-semibold capitalize">{row.status}</span></div>
                  <p className="mt-3 text-sm">Observed physical: {row.observed_hard_stock_qty} · Observed reserved: {row.observed_soft_stock_qty} · Requested physical: <strong>{row.requested_hard_stock_qty}</strong></p>
                  <p className="mt-1 text-sm text-gray-600">Current physical: {row.current_hard_stock_qty} · Current reserved: {row.current_soft_stock_qty}</p>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm">Reason: {row.reason}</p>
                  <p className="mt-2 text-xs text-gray-500">Submitted by {row.requested_by_name} · {recordedAt(row.created_at)}</p>
                  {row.decided_at && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-700">{row.status} by {row.decided_by_name} · {recordedAt(row.decided_at)}. {row.decision_note}</p>}
                  {!supervisor && row.is_stale && <p className="mt-3 text-sm text-amber-800">Stock changed after submission. Ask your Supervisor to reject this request, then submit a fresh count.</p>}
                  {supervisor && row.status === 'pending' && <StockDecisionForm adjustment={row} onSaved={saved} onFailure={failed} />}
                </article>;
              })}
            </section>
          )}
          {view === 'low' && (
            <section className="space-y-5">
              <div><h2 className="mb-2 text-lg font-semibold">Products at or below their low-stock threshold</h2><p className="mb-3 text-sm text-gray-600">Products without a configured threshold are not flagged. Your Supervisor manages these thresholds.</p><ProductTable products={lowStock} /></div>
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
