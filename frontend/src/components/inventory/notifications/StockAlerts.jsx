import { useEffect, useState } from 'react';
import { getStockAlerts, acknowledgeStockAlert } from '../../../services/api';
import { databaseDate } from '../../../services/dates';

export default function StockAlerts() {
  const [data, setData] = useState(null), [error, setError] = useState(''), [version, setVersion] = useState(0), [busy, setBusy] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    getStockAlerts({ signal: controller.signal }).then(setData).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, [version]);
  async function read(id) {
    setBusy(id);
    try { await acknowledgeStockAlert(id); setVersion(v => v + 1); } catch (e) { setError(e.message); } finally { setBusy(null); }
  }
  return <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Automatic low-stock alerts</h2><button type="button" onClick={() => { setError(''); setVersion(v => v + 1); }} className="rounded-lg border px-4 py-2 text-sm">Refresh alerts</button></div>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {!data && !error && <p role="status" className="mt-3">Loading alerts…</p>}
    {data && <><p className="mt-2 text-sm text-slate-600">{data.store.store_name} · Alerts use sellable availability and your configured reorder level.</p><ul className="mt-4 divide-y">{data.alerts.map(alert => <li key={alert.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><h3 className="font-semibold">{alert.product_name}</h3><p className="text-sm">Available at detection: {alert.available_qty} · Reorder level: {alert.reorder_level}</p><p className="mt-1 text-sm text-slate-500">{databaseDate(alert.created_at)?.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} · {alert.recovered_at ? 'Recovered / policy no longer triggered' : 'Low-stock episode'}</p></div>{alert.read_at ? <span className="text-sm text-green-800">Acknowledged</span> : <button type="button" disabled={busy === alert.id} onClick={() => read(alert.id)} className="rounded-lg border border-green-800 px-4 py-2 text-sm text-green-800">{busy === alert.id ? 'Saving…' : 'Acknowledge'}</button>}</li>)}</ul>{data.alerts.length === 0 && <p className="mt-4 text-sm text-slate-500">No automatic alerts recorded.</p>}</>}
  </section>;
}
