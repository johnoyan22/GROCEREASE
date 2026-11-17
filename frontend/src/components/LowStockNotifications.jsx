import { useState } from 'react';
import { Link } from 'react-router-dom';
import useStorePage from '../hooks/useStorePage';
import { getLowStockNotifications, readLowStockNotification } from '../services/api';
import { databaseDate } from '../services/dates';
import { sellingUnits } from '../services/product-units';

export default function LowStockNotifications() {
  const [page, setPage] = useState(1), [unread, setUnread] = useState(false);
  const [pending, setPending] = useState(null), [error, setError] = useState('');
  const state = useStorePage(getLowStockNotifications, { page, unread }, true);
  const meta = state.data?.pagination;
  async function read(id) {
    if (pending) return;
    setPending(id); setError('');
    try { await readLowStockNotification(id); state.reload(); }
    catch (failure) { setError(failure.message); }
    finally { setPending(null); }
  }
  return <section aria-label="Automatic low-stock notifications" className="mb-5 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Low-stock notifications</h2><div className="flex items-center gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={unread} onChange={(e) => { setUnread(e.target.checked); setPage(1); }} />Unread only</label><button onClick={state.reload} className="rounded-lg border bg-white px-3 py-2 text-sm">Refresh notifications</button></div></div>
    <p className="text-sm text-gray-600">One notification per low-stock episode. Marking it read does not resolve the physical stock condition.</p>
    {state.loading && <p role="status" className="text-sm">Loading notifications…</p>}
    {(state.error || error) && <p role="alert" className="text-sm text-red-700">{state.error || error}<button onClick={state.reload} className="ml-3 underline">Retry notifications</button></p>}
    {state.data && <>
      {state.data.notifications.length === 0 && <p className="rounded-xl border bg-white p-5 text-sm text-gray-600">No low-stock notifications.</p>}
      {state.data.notifications.map((notice) => { const event = notice.episode; return <article key={notice.id} className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{event.product_name} · {event.sku}</h3><span className="text-xs font-medium">{notice.read_at ? 'Read' : 'Unread'}</span></div>
        <p className="mt-2 text-sm">At alert: {event.observed_physical_qty} {sellingUnits(event, event.observed_physical_qty)} physical · Re-order Level: {event.reorder_level} {sellingUnits(event, event.reorder_level)}</p>
        <p className="mt-1 text-xs text-gray-500">Event: {databaseDate(event.started_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>
        <p className="mt-2 text-sm">Current physical: {notice.current.physical_quantity} {sellingUnits(notice.current, notice.current.physical_quantity)} · Current Re-order Level: {notice.current.reorder_level == null ? 'Not configured' : `${notice.current.reorder_level} ${sellingUnits(notice.current, notice.current.reorder_level)}`} · {notice.current.is_low_stock ? 'Low stock' : 'Not currently low'}</p>
        {event.closed_at && <p className="mt-1 text-xs text-gray-600">Episode closed: {event.closure_reason.replaceAll('_', ' ')} · {databaseDate(event.closed_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>}
        <div className="mt-3 flex flex-wrap gap-3"><Link to={notice.link} className="text-sm font-medium text-green-800 underline">Open Low Stock Monitoring</Link>{!notice.read_at && <button disabled={!!pending} onClick={() => read(notice.id)} className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40">Mark as read</button>}</div>
      </article>; })}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><p>Page {meta.current_page} of {meta.last_page} · {meta.total} notifications</p><div className="flex gap-2"><button disabled={meta.current_page <= 1} onClick={() => setPage(meta.current_page - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Previous notifications</button><button disabled={meta.current_page >= meta.last_page} onClick={() => setPage(meta.current_page + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Next notifications</button></div></div>
    </>}
  </section>;
}
