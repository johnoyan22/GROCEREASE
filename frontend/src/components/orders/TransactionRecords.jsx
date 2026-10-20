import { useEffect, useState } from 'react';
import { getTransactionRecords } from '../../services/api';
import OrderReceipt from './OrderReceipt';
import { philippineDay } from '../../services/dates';

const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

export default function TransactionRecords({ role, title = 'Transaction records', report = false }) {
  const [rows, setRows] = useState([]);
  const [store, setStore] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [from, setFrom] = useState('');
  const [until, setUntil] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  useEffect(function () {
    const controller = new AbortController();
    let active = true;
    getTransactionRecords(role, { signal: controller.signal }).then(function (result) {
      if (active) { setRows(result.transactions); setStore(result.store ?? null); setLoading(false); }
    }).catch(function (failure) { if (active && failure.name !== 'AbortError') { setError(failure.message); setLoading(false); } });
    return function () { active = false; controller.abort(); };
  }, [role, version]);
  function refresh() { setRows([]); setStore(null); setError(''); setLoading(true); setVersion(function (value) { return value + 1; }); }
  const filtered = rows.filter(function (row) {
    const day = philippineDay(row.confirmed_at);
    return (!from || day >= from) && (!until || day <= until) && (!selectedStore || String(row.store_id) === selectedStore)
      && [row.order_id, row.store_name, row.shopper_name, row.payment_method].join(' ').toLowerCase().includes(search.toLowerCase());
  });
  const stores = [...new Map(rows.map(row => [row.store_id, row.store_name]))];
  const gross = filtered.filter(row => row.refund_status !== 'completed').reduce((sum, row) => sum + row.amount_centavos, 0);
  return <div className="space-y-5">{report && <section className="rounded-xl border border-gray-200 bg-white p-5"><h2 className="font-semibold">Payment report</h2><p className="mt-2 text-sm">{loading ? 'Loading totals...' : error ? 'Totals not available' : filtered.length + ' verified payment records. Gross supermarket payments, excluding completed refunds: ' + money.format(gross / 100)}</p><p className="mt-2 text-xs text-gray-500">The selected period uses payment confirmation dates in Asia/Manila. Blank dates include all recorded dates. SaaS subscriptions and worker payouts are separate and not configured.</p></section>}<h1 className="text-2xl font-bold">{title}{store ? ' · '+store.store_name : ''}</h1><p className="text-sm text-gray-600">Confirmed payments and physical handovers. Grocery revenue and service fees remain separate. GrocerEase adds no platform markup or automatic worker payout.</p><div className="flex flex-wrap gap-3"><label className="text-xs">From<input type="date" aria-label="Payment report from date" value={from} onChange={event => setFrom(event.target.value)} className="ml-2 rounded-lg border border-gray-300 p-2" /></label><label className="text-xs">Until<input type="date" aria-label="Payment report until date" min={from} value={until} onChange={event => setUntil(event.target.value)} className="ml-2 rounded-lg border border-gray-300 p-2" /></label>{role === 'admin' && <select aria-label="Report supermarket" value={selectedStore} onChange={event => setSelectedStore(event.target.value)} className="rounded-lg border border-gray-300 p-2 text-sm"><option value="">All supermarkets</option>{stores.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>}</div><div className="flex gap-3"><input type="search" aria-label="Search transactions" placeholder="Search order, store, or Shopper" value={search} onChange={function (event) { setSearch(event.target.value); }} className="flex-1 rounded-lg border border-gray-300 p-2 text-sm" /><button type="button" onClick={refresh} className="rounded-lg border border-green-700 px-4 py-2 text-sm text-green-800">Refresh</button></div>{loading && <p role="status">Loading transactions...</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}{!loading && !error && <div className="space-y-4">{filtered.map(function (row) { return <article key={row.transaction_id} className="rounded-xl border border-gray-200 bg-white p-5"><h2 className="font-semibold">Transaction #{row.transaction_id} · Order #{row.order_id} · {row.store_name}</h2><p className="mt-2 text-sm">{row.shopper_name} · {row.payment_method === 'cash_on_pickup' ? 'Cash on Pickup' : row.payment_method} · {row.status.replaceAll('_', ' ')} · {row.payment_status}</p><p className="mt-2 text-sm">Groceries: {money.format(row.subtotal_centavos / 100)} · Service fee: {money.format(row.service_fee_centavos / 100)} · Paid: {money.format(row.amount_centavos / 100)}</p><p className="mt-2 text-xs text-gray-600">Handover: {row.handed_over_at ? 'Recorded' : 'Pending'} · Refund: {row.refund_status.replaceAll('_', ' ')}</p>{row.status === 'completed' && row.handed_over_at && <OrderReceipt orderId={row.order_id} role={role} />}</article>; })}{filtered.length === 0 && <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">No confirmed transactions match this view.</p>}</div>}</div>;
}
