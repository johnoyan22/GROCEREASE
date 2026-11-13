import { useEffect, useState } from 'react';
import { getAdminStores, getReportData } from '../../services/api';
import PdfExportButton from '../shared/PdfExportButton';

const labels = { sales: 'Verified sales payments', transactions: 'Verified transactions', orders: 'Order summary', stock: 'Current stock', 'low-stock': 'Low stock and reorder', cop: 'COP failures and restrictions' };
const kindsByRole = { inventory_worker: ['stock', 'low-stock'], supervisor: ['sales', 'transactions', 'orders', 'stock', 'low-stock'], admin: ['sales', 'transactions', 'stock', 'low-stock', 'cop'] };
const blank = { from: '', until: '', store_id: '', search: '', status: '', category: '', upcoming: false };

export default function ReportWorkspace({ role, initialKind }) {
  const kinds = kindsByRole[role] || [];
  const [kind, setKind] = useState(kinds.includes(initialKind) ? initialKind : kinds[0]);
  const [stores, setStores] = useState([]), [storeError, setStoreError] = useState('');
  useEffect(() => {
    if (role !== 'admin') return;
    const controller = new AbortController();
    getAdminStores({ signal: controller.signal }).then(result => setStores(result.stores)).catch(failure => { if (failure.name !== 'AbortError') setStoreError('Store filter options could not load. Refresh this Reports page to try again.'); });
    return () => controller.abort();
  }, [role]);
  if (!kind) return <p role="alert">Reports are available only to authorized staff.</p>;
  return <div className="mx-auto max-w-7xl space-y-5"><header><h1 className="text-2xl font-bold text-green-950">Reports</h1><p className="mt-2 text-sm text-slate-600">Read-only reports from actual records. PDF exports contain every matching record, including records on other report pages.</p>{role === 'inventory_worker' && <p className="mt-2 text-xs text-slate-600">Operational stock reports for your assigned active store. No financial reports or inventory edits.</p>}</header>
    <label className="block max-w-md text-sm font-semibold">Report type<select value={kind} onChange={event => setKind(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3">{kinds.map(value => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
    {storeError && <p role="alert" className="text-sm text-red-700">{storeError}</p>}
    <ReportPanel key={kind} role={role} kind={kind} stores={stores} />
  </div>;
}

function ReportPanel({ role, kind, stores }) {
  const [form, setForm] = useState(blank), [filters, setFilters] = useState(blank);
  const [page, setPage] = useState(1), [version, setVersion] = useState(0);
  const [data, setData] = useState(null), [error, setError] = useState('');
  const stock = kind === 'stock' || kind === 'low-stock';
  const dirty = JSON.stringify(form) !== JSON.stringify(filters);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    getReportData(role, kind, { ...filters, page }, { signal: controller.signal }).then(result => { if (active) setData(result); })
      .catch(failure => { if (active && failure.name !== 'AbortError') setError(failure.message || 'Report could not be loaded.'); });
    return () => { active = false; controller.abort(); };
  }, [role, kind, filters, page, version]);
  function update(name, value) { setForm(current => ({ ...current, [name]: value })); }
  function apply(event) { event.preventDefault(); const next = { ...form, search: form.search.trim(), category: form.category.trim() }; setForm(next); setFilters(next); setPage(1); setData(null); setError(''); setVersion(current => current + 1); }
  function refresh() { setData(null); setError(''); setVersion(current => current + 1); }
  function changePage(value) { setPage(value); setData(null); setError(''); }
  const report = data?.report;
  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
  return <section aria-label={labels[kind] + ' report'} className="min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
    <h2 className="text-xl font-semibold text-green-950">{labels[kind]}</h2>
    <form onSubmit={apply} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {role === 'admin' && <label className="text-sm">Supermarket<select value={form.store_id} onChange={event => update('store_id', event.target.value)} className={inputClass}><option value="">All stores</option>{stores.map(store => <option key={store.store_id} value={store.store_id}>{store.store_name}</option>)}</select></label>}
      <label className="text-sm">Search report<input type="search" maxLength={255} value={form.search} onChange={event => update('search', event.target.value)} className={inputClass} /></label>
      {stock && <label className="text-sm">Category<input type="text" maxLength={100} placeholder="Exact category name, or leave blank" value={form.category} onChange={event => update('category', event.target.value)} className={inputClass} /></label>}
      {(kind === 'stock' || kind === 'orders') && <label className="text-sm">Status<select value={form.status} onChange={event => update('status', event.target.value)} className={inputClass}><option value="">All statuses</option>{(stock ? ['active', 'inactive'] : ['waiting', 'preparing', 'ready_for_pickup', 'completed', 'canceled', 'unclaimed']).map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>}
      {!stock && <><label className="text-sm">From date<input type="date" value={form.from} onChange={event => update('from', event.target.value)} className={inputClass} /></label><label className="text-sm">Until date<input type="date" min={form.from} value={form.until} onChange={event => update('until', event.target.value)} className={inputClass} /></label></>}
      {kind === 'orders' && <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.upcoming} onChange={event => update('upcoming', event.target.checked)} />Upcoming pickup only</label>}
      <div className="flex items-end gap-2"><button type="submit" className="ge-button">Apply filters</button><button type="button" onClick={refresh} disabled={!data && !error} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm disabled:opacity-40">Refresh report</button></div>
    </form>
    {dirty && <p role="status" className="text-sm text-amber-800">Apply your filter changes before exporting.</p>}
    {!data && !error && <p role="status" className="py-5 text-sm text-slate-600">Loading report…</p>}
    {error && <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800"><p>{error}</p><button type="button" onClick={refresh} className="mt-2 min-h-11 font-semibold underline">Retry report</button></div>}
    {report && <><p className="text-sm text-slate-700"><strong>Scope:</strong> {report.scope}<br /><strong>Period:</strong> {report.period_label || (report.from || 'All recorded dates') + ' to ' + (report.until || 'Latest recorded date')}<br /><strong>Generated:</strong> {report.generated_at}</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(report.totals).map(([label, value]) => <div key={label} className="rounded-lg bg-green-50 p-3"><p className="text-xs text-green-900">{label}</p><p className="mt-1 break-words font-semibold text-green-950">{value}</p></div>)}</div>
    </>}
    <PdfExportButton role={role} kind={kind} filters={filters} disabled={!data || Boolean(error) || dirty} />
    {report && <><p className="text-xs text-slate-600">Showing {report.rows.length} of {data.pagination.total} matching records · Page {page} of {data.pagination.last_page}. PDF includes all matching records. Exports over 5,000 records require narrower filters.</p>
      <div className="max-w-full overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><caption className="sr-only">{report.report_title} · {report.scope}</caption><thead><tr className="border-b border-slate-300 bg-green-50">{report.headings.map(heading => <th key={heading} scope="col" className="px-3 py-3 font-semibold text-green-950">{heading}</th>)}</tr></thead><tbody>{report.rows.map((row, index) => <tr key={index} className="border-b border-slate-100">{row.map((value, column) => <td key={column} className="max-w-xs break-words px-3 py-3 align-top">{value}</td>)}</tr>)}{report.rows.length === 0 && <tr><td colSpan={report.headings.length} className="px-3 py-8 text-slate-600">No records match these filters.</td></tr>}</tbody></table></div><p className="text-xs text-slate-600">{report.note}</p>
      <div className="flex flex-wrap gap-3"><button type="button" disabled={page <= 1} onClick={() => changePage(page - 1)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm disabled:opacity-40">Previous report page</button><button type="button" disabled={page >= data.pagination.last_page} onClick={() => changePage(page + 1)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm disabled:opacity-40">Next report page</button></div>
    </>}
  </section>;
}
