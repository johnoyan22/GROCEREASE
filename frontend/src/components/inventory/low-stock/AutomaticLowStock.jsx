import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAutomaticLowStock } from '../../../services/api';
import { sellingUnits } from '../../../services/product-units';
import useStorePage from '../../../hooks/useStorePage';
import StoreSelector from '../layout/StoreSelector';
import ProductDetailsModal from '../product-management/ProductDetailsModal';

export default function AutomaticLowStock({ supervisor = false }) {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [details, setDetails] = useState(null);
  const state = useStorePage(getAutomaticLowStock, { search, page, product: params.get('product') || '', store: params.get('store') || '' }, true);
  const meta = state.data?.pagination;
  return <div>
    <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row"><div><h1 className="text-2xl font-bold">Low Stock Monitoring</h1><p className="mt-1 text-sm text-gray-600">Automatic alerts when physical stock is at or below the configured Re-order Level. Reservations and expiry affect sellable availability separately.</p></div><StoreSelector store={state.store} loading={state.loading} error={state.error} /></div>
    <div className="mb-4 flex flex-wrap gap-3"><input aria-label="Search low-stock products" type="search" maxLength="100" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search product or SKU" className="min-w-0 flex-1 rounded-lg border bg-white p-2.5 text-sm" />
      {(params.has('product') || params.has('store')) && <button onClick={() => { const next = new URLSearchParams(params); next.delete('product'); next.delete('store'); setParams(next); setPage(1); }} className="rounded-lg border bg-white px-4 py-2 text-sm">All current-store products</button>}
      <button onClick={state.reload} className="rounded-lg border border-green-700 bg-white px-4 py-2 text-sm text-green-800">Refresh</button></div>
    {state.loading && <p role="status" className="p-4 text-sm">Loading low-stock products…</p>}
    {state.error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{state.error}<button onClick={state.reload} className="ml-3 underline">Retry</button></p>}
    {state.data && <section className="overflow-hidden rounded-xl border border-gray-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left text-sm"><thead className="bg-gray-50"><tr>{['Product / SKU', 'Physical Stock', 'Re-order Level', 'Shortfall', 'Actions'].map((name) => <th key={name} scope="col" className="p-3 font-medium">{name}</th>)}</tr></thead><tbody>{state.data.inventory.map((item) => <tr key={item.store_inventory_id} className="border-t"><td className="p-3"><p className="font-medium">{item.product_name}</p><p className="mt-1 text-xs text-gray-500">{item.sku}</p><span className="text-xs font-semibold text-amber-800">Low stock</span></td><td className="p-3">{item.hard_stock_qty} {sellingUnits(item, item.hard_stock_qty)}</td><td className="p-3">{item.low_stock_threshold} {sellingUnits(item, item.low_stock_threshold)}</td><td className="p-3">{item.shortfall} {sellingUnits(item, item.shortfall)}</td><td className="p-3"><button onClick={() => setDetails(item)} className="rounded-lg border px-3 py-2">View Details</button></td></tr>)}</tbody></table>{state.data.inventory.length === 0 && <p className="p-6 text-center text-sm text-gray-600">No low-stock products.</p>}</div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t p-3 text-sm"><p>Showing {meta.from ?? 0}–{meta.to ?? 0} of {meta.total} · Page {meta.current_page} of {meta.last_page}</p><div className="flex gap-2"><button disabled={meta.current_page <= 1} onClick={() => setPage(meta.current_page - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Previous</button><button disabled={meta.current_page >= meta.last_page} onClick={() => setPage(meta.current_page + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Next</button></div></div></section>}
    {details && <ProductDetailsModal product={details} supervisor={supervisor} onClose={() => setDetails(null)} onSaved={() => { setDetails(null); state.reload(); }} />}
  </div>;
}
