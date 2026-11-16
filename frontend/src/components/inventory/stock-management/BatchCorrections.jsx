import { useEffect, useRef, useState } from 'react';
import { getCorrectionBatches } from '../../../services/api';
import { sellingUnits } from '../../../services/product-units';
import StoreSelector from '../layout/StoreSelector';
import BatchCountModal from './BatchCountModal';

const filters = { search: '', product: '', condition: '', includeEmpty: false, page: 1 };
const conditions = { active: 'Active', expired: 'Expired', on_hold: 'On hold', empty: 'Empty' };

export default function BatchCorrections() {
  const [query, setQuery] = useState(filters);
  const [revision, setRevision] = useState(0);
  const [response, setResponse] = useState({ key: '', data: null, error: '' });
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');
  const storeId = useRef(null);
  const pager = useRef(null);
  const key = JSON.stringify([query, revision]);
  const loading = response.key !== key;
  const data = loading ? null : response.data;
  const products = response.data?.products || [];
  const meta = data?.pagination;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    getCorrectionBatches({ ...query, signal: controller.signal }).then((result) => {
      if (!result.store || !Array.isArray(result.batches) || result.batches.length > 10 || !Array.isArray(result.products)
        || result.pagination?.per_page !== 10 || result.pagination.current_page < 1 || result.pagination.current_page > result.pagination.last_page) {
        throw new Error('Unexpected batch response. Please retry.');
      }
      if (active) {
        if (storeId.current && storeId.current !== result.store.store_id) {
          setSelected(null); setNotice('Your store assignment changed. Review the current store before counting.');
        }
        storeId.current = result.store.store_id;
        setResponse({ key, data: result, error: '' });
      }
    }).catch((error) => {
      if (active && error.name !== 'AbortError') setResponse({ key, data: null, error: error.message || 'Could not load recorded batches.' });
    });
    return () => { active = false; controller.abort(); };
  }, [query, revision, key]);

  function filter(name, value) { setQuery((current) => ({ ...current, [name]: value, page: 1 })); }
  function navigate(page) { pager.current?.focus(); setQuery((current) => ({ ...current, page })); }
  const inputClass = 'rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm';
  return <div>
    <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row"><div><h1 className="text-2xl font-bold text-gray-900">Stock Corrections</h1><p className="mt-1 text-sm text-gray-600">Record an actual batch remaining count for Supervisor approval.</p></div><StoreSelector store={response.data?.store ?? null} loading={loading} error={response.error} /></div>
    <div className="mb-4 flex justify-end"><button type="button" onClick={() => setRevision((n) => n + 1)} className={inputClass}>Refresh</button></div>
    {notice && <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <input aria-label="Search batches" type="search" maxLength="100" value={query.search} onChange={(e) => filter('search', e.target.value)} placeholder="Search product, SKU or Batch No." className={inputClass + ' min-w-0 flex-1 basis-64'} />
      <select aria-label="Product filter" value={query.product} onChange={(e) => filter('product', e.target.value)} className={inputClass + ' max-w-full'}><option value="">All products</option>{products.map((p) => <option key={p.product_id} value={p.product_id}>{p.product_name} ({p.sku})</option>)}</select>
      <select aria-label="Stock Condition" value={query.condition} onChange={(e) => filter('condition', e.target.value)} className={inputClass}><option value="">All conditions</option>{Object.entries(conditions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <button type="button" onClick={() => setQuery({ ...filters })} className={inputClass}>Clear Filters</button>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={query.includeEmpty} onChange={(e) => filter('includeEmpty', e.target.checked)} />Include empty batches</label>
    </div>
    {loading && <p role="status" className="py-6 text-sm text-gray-600">Loading recorded batches…</p>}
    {!loading && response.error && <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{response.error}<button onClick={() => setRevision((n) => n + 1)} className="ml-3 rounded-lg border px-3 py-2">Retry batches</button></div>}
    {data && <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-gray-50"><tr>{['Product', 'Batch No.', 'Recorded Remaining Stock', 'Date Received', 'Expiry Date', 'Stock Condition', 'Action'].map((h) => <th key={h} scope="col" className="px-4 py-3 font-medium text-gray-600">{h}</th>)}</tr></thead>
        <tbody>{data.batches.map((b) => <tr key={b.id} className="border-t border-gray-100 align-top"><td className="px-4 py-3"><p className="font-medium">{b.product_name}</p><p className="mt-1 text-xs text-gray-500">{b.size || 'Size unconfigured'} · {b.sku}</p></td><td className="px-4 py-3 font-medium">{b.batch_no}</td><td className="px-4 py-3">{b.remaining_quantity} {sellingUnits(b, b.remaining_quantity)}</td><td className="px-4 py-3">{b.received_date || 'Unknown'}</td><td className="px-4 py-3">{b.expiry_date || 'Unknown / not applicable'}</td><td className="px-4 py-3"><span className={b.stock_condition === 'expired' ? 'text-red-700' : b.stock_condition === 'on_hold' ? 'text-amber-800' : 'text-gray-700'}>{conditions[b.stock_condition] || b.stock_condition}</span>{b.remaining_quantity === 0 && <span className="block text-xs text-gray-500">Empty</span>}{b.pending_adjustment_id && <span className="mt-1 block text-xs text-amber-800">Correction pending</span>}</td><td className="px-4 py-3"><button disabled={!!b.pending_adjustment_id} onClick={() => setSelected(b)} className="whitespace-nowrap rounded-lg border border-green-700 px-3 py-2 text-sm font-medium text-green-800 disabled:opacity-40" aria-label={'Update Count ' + b.batch_no}>Update Count</button></td></tr>)}</tbody>
      </table>{data.batches.length === 0 && <p className="p-6 text-sm text-gray-600">No matching recorded batches.</p>}</div>
      <div ref={pager} tabIndex={-1} className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm"><p>Showing {meta.from ?? 0}–{meta.to ?? 0} of {meta.total} batches · Page {meta.current_page} of {meta.last_page}</p><div className="flex gap-2"><button disabled={meta.current_page <= 1} onClick={() => navigate(meta.current_page - 1)} className={inputClass + ' disabled:opacity-40'}>Previous</button><button disabled={meta.current_page >= meta.last_page} onClick={() => navigate(meta.current_page + 1)} className={inputClass + ' disabled:opacity-40'}>Next</button></div></div>
    </div>}
    {selected && <BatchCountModal key={selected.id} batch={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); setNotice('Correction submitted. Track it in Stock Request.'); setRevision((n) => n + 1); }} />}
  </div>;
}
