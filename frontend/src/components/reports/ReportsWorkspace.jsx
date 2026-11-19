import { useEffect, useRef, useState } from 'react';
import { downloadReportPdf, generateReport, getReportOptions, getReportPreview } from '../../services/api';
import { formatCentavos } from '../../services/money';

const field = 'mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm';
const button = 'rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50';
const time = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });
const display = (value, format) => format === 'money' ? formatCentavos(value) : String(value ?? '');

export default function ReportsWorkspace(props) { return <ReportWorkspace key={props.role+':'+(props.initialType ?? '')} {...props} />; }

function ReportWorkspace({ role, initialType }) {
  const [options, setOptions] = useState(null), [filters, setFilters] = useState(null);
  const [report, setReport] = useState(null), [reportKey, setReportKey] = useState('');
  const [pages, setPages] = useState({}), [pending, setPending] = useState(false), [exporting, setExporting] = useState(false);
  const [error, setError] = useState(''), [expired, setExpired] = useState(false), [version, setVersion] = useState(0);
  const revision = useRef(0), operation = useRef(null), active = useRef(false), exportBusy = useRef(false);
  useEffect(function () {
    active.current = true;
    const controller = new AbortController();
    getReportOptions({ signal: controller.signal }).then(result => {
      if (!active.current) return;
      if (!Array.isArray(result.types) || result.types.length === 0) throw new Error('Report options are unavailable.');
      const first = result.types.some(type => type.id === initialType) ? initialType : result.types[0].id;
      setOptions(result); setFilters({ type: first, from: result.from, until: result.until, store_id: '', search: '', status: 'all', mode: first === 'financial' ? 'actual' : 'all' });
    }).catch(failure => { if (active.current && failure.name !== 'AbortError') setError(failure.message); });
    return () => { active.current = false; controller.abort(); operation.current?.abort(); };
  }, [initialType, role, version]);
  useEffect(function () {
    if (!report) return;
    const timer = setTimeout(() => setExpired(true), Math.max(0, Date.parse(report.expires_at) - Date.now()));
    return () => clearTimeout(timer);
  }, [report]);
  const key = JSON.stringify(filters);
  const stale = Boolean(report) && (reportKey !== key || expired);
  const type = options?.types.find(option => option.id === filters?.type);
  const inventory = ['current_stock', 'batches', 'stock_changes', 'availability'].includes(filters?.type);
  function change(name, value) {
    revision.current++; operation.current?.abort(); setPending(false); setError(''); setReportKey('');
    setFilters(current => ({ ...current, [name]: value, ...(name === 'type' ? { status: 'all', search: '', mode: value === 'financial' ? 'actual' : 'all' } : {}) }));
  }
  function accessFailure(failure) {
    if ([401, 403, 410].includes(failure.status)) { setReport(null); setReportKey(''); setExpired(true); }
    setError(failure.message);
  }
  async function generate(event) {
    event.preventDefault(); if (pending || !filters) return;
    const current = ++revision.current, controller = new AbortController(); operation.current?.abort(); operation.current = controller;
    const chosenKey = key;
    const body = { type: filters.type,
      ...(type.period ? { from: filters.from, until: filters.until } : {}),
      ...(role === 'admin' && filters.store_id ? { store_id: Number(filters.store_id) } : {}),
      ...(inventory ? { search: filters.search } : {}),
      ...(['batches', 'stock_changes'].includes(filters.type) ? { status: filters.status } : {}),
      ...(['payments', 'financial'].includes(filters.type) ? { mode: filters.mode } : {}),
    };
    setPending(true); setError('');
    try {
      const result = await generateReport(body, { signal: controller.signal });
      if (!active.current || current !== revision.current) return;
      setReport(result.report); setReportKey(chosenKey); setPages({}); setExpired(false);
    } catch (failure) { if (active.current && current === revision.current && failure.name !== 'AbortError') accessFailure(failure); }
    finally { if (active.current && current === revision.current) setPending(false); }
  }
  async function paginate(section, page) {
    if (!report || stale || pending) return;
    const current = ++revision.current, controller = new AbortController(); operation.current = controller;
    const next = { ...pages, [section]: page }; setPending(true); setError('');
    try {
      const result = await getReportPreview(report.id, next, { signal: controller.signal });
      if (active.current && current === revision.current) { setReport(result.report); setPages(next); }
    } catch (failure) { if (active.current && current === revision.current && failure.name !== 'AbortError') accessFailure(failure); }
    finally { if (active.current && current === revision.current) setPending(false); }
  }
  async function exportPdf() {
    if (!report || stale || pending || exportBusy.current) return;
    exportBusy.current = true; setExporting(true); setError('');
    const current = revision.current, controller = new AbortController(); operation.current = controller;
    try {
      const { blob, filename } = await downloadReportPdf(report.id, { signal: controller.signal });
      if (!active.current || current !== revision.current) return;
      const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) { if (active.current && current === revision.current && failure.name !== 'AbortError') accessFailure(failure); }
    finally { exportBusy.current = false; if (active.current) setExporting(false); }
  }
  return <div className="min-w-0 space-y-5 [overflow-wrap:anywhere]">
    <div><h1 className="text-2xl font-bold">Reports</h1>{options?.store && <p className="mt-2 text-sm font-semibold">{options.store.store_name}</p>}</div>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!options && !error && <p role="status">Loading report options...</p>}
    {!options && error && <button type="button" onClick={() => { setError(''); setVersion(value => value + 1); }} className={button}>Retry report options</button>}
    {options && filters && <form onSubmit={generate} className="rounded-xl border border-gray-200 bg-white p-4">
      <fieldset disabled={exporting} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm">Report type<select aria-label="Report type" value={filters.type} onChange={event => change('type', event.target.value)} className={field}>{options.types.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <label className="text-sm">From<input aria-label="Report from date" required={type?.period} disabled={!type?.period} type="date" value={type?.period ? filters.from : ''} onChange={event => change('from', event.target.value)} className={field} /></label>
        <label className="text-sm">Until<input aria-label="Report until date" required={type?.period} disabled={!type?.period} type="date" min={filters.from} value={type?.period ? filters.until : ''} onChange={event => change('until', event.target.value)} className={field} /></label>
        {role === 'admin' && <label className="text-sm">Store<select aria-label="Report store" value={filters.store_id} onChange={event => change('store_id', event.target.value)} className={field}><option value="">All authorized stores</option>{options.stores.map(store => <option key={store.store_id} value={store.store_id}>{store.store_name}</option>)}</select></label>}
        {inventory && <label className="text-sm">Search product / SKU{filters.type === 'batches' || filters.type === 'stock_changes' ? ' / batch' : ''}<input aria-label="Report search" type="search" maxLength="100" value={filters.search} onChange={event => change('search', event.target.value)} className={field} /></label>}
        {['batches', 'stock_changes'].includes(filters.type) && <label className="text-sm">Status<select aria-label="Report status" value={filters.status} onChange={event => change('status', event.target.value)} className={field}>{(filters.type === 'batches' ? ['all', 'active', 'expired', 'depleted', 'on_hold', 'inactive', 'expiring_30'] : ['all', 'approved', 'pending', 'rejected']).map(status => <option key={status} value={status}>{status === 'expiring_30' ? 'Expiring within 30 days' : status.replaceAll('_', ' ')}</option>)}</select></label>}
        {['payments', 'financial'].includes(filters.type) && <label className="text-sm">Payment mode<select aria-label="Report payment mode" value={filters.mode} onChange={event => change('mode', event.target.value)} className={field}>{filters.type === 'payments' && <option value="all">All modes, separated</option>}<option value="actual">Actual collections</option><option value="test">Test / Sandbox only</option>{filters.type === 'payments' && <option value="legacy">Legacy / unclassified only</option>}</select></label>}
      </fieldset>
      <p className="mt-4 text-xs text-gray-600">{type?.period ? 'Philippine dates. Maximum 93 days.' : 'Current snapshot.'}</p>
      <div className="mt-4 flex flex-wrap gap-3"><button disabled={pending || exporting} className={button}>{pending ? 'Loading report...' : 'Generate Report'}</button><button type="button" disabled={!report || stale || pending || exporting} onClick={exportPdf} className="rounded-lg border border-green-700 px-4 py-2.5 text-sm font-semibold text-green-800 disabled:opacity-50">{exporting ? 'Exporting PDF...' : 'Export PDF'}</button></div>
    </form>}
    {stale && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{expired ? 'This report expired. Generate again before exporting.' : 'Filters changed. This preview is stale; generate the report again before exporting.'}</p>}
    {report && <section aria-label="Generated report" className="min-w-0 space-y-4 border border-black bg-white p-4 text-black sm:p-5">
      <div className="border-b border-black pb-3">
        <h2 className="text-lg font-bold">{report.title}</h2>
        <p className="mt-1 text-sm">Store: {report.store_label}</p>
        <p className="mt-1 text-xs">{report.filters.from ? 'Date range: '+report.filters.from+' to '+report.filters.until+' (PH)' : 'Current as of: '+time.format(new Date(report.generated_at))+' (PH)'}</p>
        <p className="mt-1 text-xs">Generated by: {report.generated_by} ({report.role.replaceAll('_', ' ')}){report.filters.from ? ' | '+time.format(new Date(report.generated_at))+' (PH)' : ''}</p>
        {Object.entries(report.filters).filter(([name,value]) => ['search', 'status', 'mode'].includes(name) && value && value !== 'all').map(([name,value]) => <p key={name} className="mt-1 text-xs">{name === 'mode' ? 'Mode' : name === 'status' ? 'Status' : 'Search'}: {name === 'mode' ? ({actual:'Actual collections',test:'Test / Sandbox',legacy:'Legacy / unclassified'}[value] || value) : value.replaceAll('_', ' ')}</p>)}
      </div>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">{report.metrics.filter(metric => metric.visible !== false).map(metric => <div key={metric.label} className="flex flex-wrap gap-x-2 text-sm"><dt className="font-semibold">{metric.label_short ?? metric.label}:</dt><dd>{display(metric.value, metric.format)}</dd></div>)}</dl>
      {report.sections.filter(section => section.visible !== false).map(section => <section key={section.key} className="min-w-0">
        <h3 className="font-semibold">{section.title_short ?? section.title}</h3>
        {section.date_basis && <p className="my-1 text-xs">{section.date_basis}</p>}
        {section.row_count === 0 ? <p className="py-3 text-sm">No matching records.</p> : <>
          <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[580px] border-collapse text-left text-xs"><thead><tr>{section.columns.map(column => <th scope="col" key={column.key} className="border border-black px-2 py-2">{column.label}</th>)}</tr></thead><tbody>{section.rows.map((row,index) => <tr key={index}>{section.columns.map(column => <td key={column.key} className="max-w-xs break-words border border-black px-2 py-2">{display(row[column.key], column.format)}</td>)}</tr>)}</tbody></table></div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs"><p>{section.row_count} rows | Page {section.page} of {section.last_page}</p><div className="flex gap-2"><button type="button" aria-label={'Previous '+section.title+' page'} disabled={section.page <= 1 || pending || stale || exporting} onClick={() => paginate(section.key, section.page-1)} className="rounded border border-black px-3 py-2 disabled:opacity-50">Previous</button><button type="button" aria-label={'Next '+section.title+' page'} disabled={section.page >= section.last_page || pending || stale || exporting} onClick={() => paginate(section.key, section.page+1)} className="rounded border border-black px-3 py-2 disabled:opacity-50">Next</button></div></div>
        </>}
      </section>)}
      {(report.display_notes ?? report.notes).map((note,index) => <p key={index} className="text-xs">{note}</p>)}
    </section>}
  </div>;
}
