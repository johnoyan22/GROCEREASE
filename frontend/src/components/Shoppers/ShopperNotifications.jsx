import { databaseDate } from '../../services/dates';
import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { getOrderNotifications, readOrderNotification } from '../../services/api';

export default function ShopperNotifications() {
  const [state, setState] = useState({ notifications: [], loading: true, error: '' });
  const [version, setVersion] = useState(0);
  const [pending, setPending] = useState(null);
  const reload = useCallback(() => { setState({ notifications: [], loading: true, error: '' }); setVersion(v => v + 1); }, []);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    getOrderNotifications({ signal: controller.signal }).then(result => {
      if (active) setState({ notifications: result.notifications, loading: false, error: '' });
    }).catch(error => { if (active && error.name !== 'AbortError') setState({ notifications: [], loading: false, error: error.message }); });
    return () => { active = false; controller.abort(); };
  }, [version]);
  async function markRead(id) {
    setPending(id);
    try { await readOrderNotification(id); reload(); }
    catch (error) { setState(current => ({ ...current, error: error.message })); }
    finally { setPending(null); }
  }
  return <main className="min-h-screen bg-white p-6"><div className="mb-6 flex justify-between gap-4"><div><h1 className="text-xl font-bold">Notifications</h1><p className="mt-1 text-sm text-gray-600">Your latest recorded order updates.</p></div><button type="button" disabled={state.loading} onClick={reload} className="text-sm text-green-700 underline">Refresh</button></div>{state.loading && <p role="status">Loading notifications...</p>}{state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}<div className="max-w-4xl space-y-3">{state.notifications.map(item => <article key={item.id} className="flex items-start justify-between gap-4 rounded-xl border border-gray-300 p-4"><div className="flex gap-4"><Bell className="h-5 w-5 shrink-0" /><div><h2 className="text-sm font-bold">Order #{item.order_id}</h2><p className="mt-1 text-sm text-gray-600">{item.message}</p><p className="mt-2 text-xs text-gray-500">{databaseDate(item.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p></div></div>{!item.read_at && <button type="button" disabled={pending !== null} onClick={() => markRead(item.id)} className="shrink-0 text-xs font-semibold text-green-700 underline">Mark read</button>}</article>)}{!state.loading && !state.error && state.notifications.length === 0 && <p className="text-sm text-gray-500">No order notifications yet.</p>}</div></main>;
}
