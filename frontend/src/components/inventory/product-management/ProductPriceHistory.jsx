import { useEffect, useState } from 'react';
import { getProductPriceHistory } from '../../../services/api';
import { databaseDate } from '../../../services/dates';
const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
export default function ProductPriceHistory({ product }) {
  const [open, setOpen] = useState(false), [rows, setRows] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    getProductPriceHistory(product.store_inventory_id, { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setRows(result.history); }).catch(failure => { if (failure.name !== 'AbortError') setError(failure.message); });
    return () => controller.abort();
  }, [open, product.store_inventory_id]);
  return <details onToggle={event => setOpen(event.currentTarget.open)} className="min-w-40 text-xs"><summary className="py-2 font-semibold text-green-800">Price history</summary>{error && <p role="alert">{error}</p>}{!rows && !error && <p role="status">Loading…</p>}<ul className="space-y-2">{rows?.map(row => <li key={row.id} className="rounded border border-slate-200 p-2"><p>{money.format(row.old_price)} → {money.format(row.new_price)}</p><p>User #{row.changed_by_user_id} · Store #{row.store_id}</p><p>{databaseDate(row.created_at)?.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p></li>)}</ul>{rows?.length === 0 && <p>No recorded price changes.</p>}</details>;
}
