import { useRef, useState } from 'react';
import { cancelShopperOrder, updateOrderStatus, readOrderNotification } from '../../services/api';
import useOrders from '../../hooks/useOrders';
import StoreSelector from '../inventory/layout/StoreSelector';
import OrderPickup from './OrderPickup';
import OrderPreparation from './OrderPreparation';
import OrderResolution from './OrderResolution';
import OrderReceipt from './OrderReceipt';

const labels = { waiting: 'Waiting', preparing: 'Preparing', ready_for_pickup: 'Ready for pickup', completed: 'Completed', canceled: 'Canceled' };
const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const localTime = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });

function OrderCard({ order, role, workers, onSaved, onFailure }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  let statusLabel = labels[order.status];
  if (order.claim_status === 'no_show') statusLabel = 'No-Show · disposition pending';
  if (order.claim_status === 'unclaimed_pending_resolution') statusLabel = 'Unclaimed · resolution pending';
  let nextStatus = null;
  let actionLabel = '';
  if (order.status === 'waiting') { nextStatus = 'preparing'; actionLabel = 'Start preparing'; }
  if (order.status === 'preparing') { nextStatus = 'ready_for_pickup'; actionLabel = 'Mark ready for pickup'; }
  let canChangeStatus = true;
  if (order.status === 'waiting') canChangeStatus = order.assignments.some(function (entry) { return entry.status === 'assigned'; });
  if (order.status === 'preparing') canChangeStatus = order.assignments.some(function (entry) { return entry.status === 'completed'; }) && order.items.every(function (item) { return item.prepared_qty === item.quantity; });

  async function perform(action) {
    if (busy.current) return;
    if (action === 'cancel') {
      if (!reason.trim()) { setError('Enter a cancellation reason.'); return; }
      if (!window.confirm('Cancel this Waiting order and release its reserved items?')) return;
    }
    busy.current = true;
    setPending(true);
    setError('');
    try {
      let result;
      if (action === 'cancel') result = await cancelShopperOrder(order.order_id, reason.trim());
      else result = await updateOrderStatus(order.order_id, nextStatus);
      onSaved(result.message);
    } catch (failure) {
      setError(failure.message);
      onFailure(failure);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Order #{order.order_id} · {order.store_name}</h2><p className="mt-1 text-xs text-gray-500">{new Date(order.created_at).toLocaleString('en-PH')}</p></div>
        <span className="h-fit rounded-lg bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-800">{statusLabel}</span>
      </div>
      {role !== 'shopper' && <p className="mt-3 text-sm">Shopper: {order.shopper_name}</p>}
      {order.pickup_window_start_at && <p className="mt-3 text-sm font-semibold">Scheduled pickup: {localTime.format(new Date(order.pickup_window_start_at))}–{localTime.format(new Date(order.pickup_window_end_at))} (Philippine time)</p>}
      <p className="mt-3 text-sm">{order.payment_method === 'cash_on_pickup' ? 'Cash on Pickup' : order.payment_method} · Payment: <strong>{order.payment_status}</strong> · Reservation: {order.reservation_status}</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead><tr className="border-b border-gray-200"><th scope="col" className="py-2">Item</th><th scope="col">Quantity</th><th scope="col">Unit price</th><th scope="col">Line total</th></tr></thead><tbody>{order.items.map(function (item) {
        return <tr key={item.order_item_id} className="border-b border-gray-100"><td className="py-3">{item.product_name} {item.size}<span className="block text-xs text-gray-500">{item.sku}</span></td><td>{item.quantity}</td><td>{money.format(item.unit_price_centavos / 100)}</td><td>{money.format(item.line_total_centavos / 100)}</td></tr>;
      })}</tbody></table></div>
      <p className="mt-4 text-sm">Groceries: {money.format(order.subtotal_centavos / 100)} · Service charge: {money.format(order.service_fee_centavos / 100)}</p>
      <p className="mt-2 text-lg font-bold">Total: {money.format(order.total_centavos / 100)}</p>
      {order.status === 'ready_for_pickup' && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Final release requires confirmed payment, verified claimant, and recorded physical handover.</p>}
      <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold">Order status history</summary><ol className="mt-3 space-y-2">{order.history.map(function (entry) { return <li key={entry.id}>{new Date(entry.created_at).toLocaleString('en-PH')} · {labels[entry.previous_status] ?? 'Placed'} → {labels[entry.new_status]} · User #{entry.changed_by_user_id}<p className="whitespace-pre-wrap break-words text-xs text-gray-500">{entry.note}</p></li>; })}</ol></details>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      <OrderPreparation order={order} role={role} workers={workers} onSaved={onSaved} onFailure={onFailure} />
      {role === 'supervisor' && nextStatus && <button type="button" disabled={pending || !canChangeStatus} onClick={function () { perform('status'); }} className="mt-4 rounded-lg bg-green-700 px-4 py-2 text-sm text-white disabled:opacity-50">{pending ? 'Updating...' : actionLabel}</button>}
      <OrderPickup order={order} role={role} onSaved={onSaved} onFailure={onFailure} />
      {role === 'supervisor' && <OrderResolution order={order} onSaved={onSaved} onFailure={onFailure} />}
      {['shopper', 'supervisor'].includes(role) && order.status === 'completed' && <OrderReceipt orderId={order.order_id} role={role} />}
      {role === 'shopper' && order.status === 'waiting' && order.payment_status === 'unpaid' && <div className="mt-4 border-t border-gray-100 pt-4"><label className="block text-sm">Cancellation reason<textarea value={reason} disabled={pending} maxLength="500" rows="2" onChange={function (event) { setReason(event.target.value); }} className="mt-1 w-full rounded-lg border border-gray-300 p-2" /></label><button type="button" disabled={pending} onClick={function () { perform('cancel'); }} className="mt-3 rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-50">Cancel Waiting order</button></div>}
    </article>
  );
}

export default function OrderWorkspace({ role, title = 'Orders' }) {
  const orders = useOrders(role);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [notice, setNotice] = useState('');
  const [upcoming, setUpcoming] = useState(false);
  const filtered = orders.orders.filter(function (order) {
    return (!status || order.status === status) && (!upcoming || (['waiting', 'preparing', 'ready_for_pickup'].includes(order.status) && new Date(order.pickup_window_end_at).getTime() >= orders.asOf))
      && [order.order_id, order.store_name, order.shopper_name].join(' ').toLowerCase().includes(search.toLowerCase());
  });

  function saved(message) { setNotice(message); orders.reload(); }
  function failed(error) {
    if ([401, 403, 404, 409].includes(error.status)) { setNotice(error.message); orders.reload(); }
  }

  async function markRead(id) {
    try { await readOrderNotification(id); orders.reload(); }
    catch (failure) { setNotice(failure.message); }
  }

  return (
    <div>
      <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row">
        <div><h1 className="text-2xl font-bold">{title}</h1><p className="mt-1 text-sm text-gray-600">Track actual orders, pickup schedules, preparation, payment, and release.</p></div>
        {role !== 'shopper' && <StoreSelector store={orders.store} loading={orders.loading} error={orders.error} />}
      </div>
      {notice && <p role="status" className="mb-4 rounded-lg border border-gray-200 bg-white p-3 text-sm">{notice}</p>}
      {role === 'supervisor' && !orders.loading && !orders.error && <p className="mb-4 text-sm">Available workers: {orders.workers.filter(function (worker) { return worker.availability === 'Available'; }).length} · Busy workers: {orders.workers.filter(function (worker) { return worker.availability === 'Busy'; }).length}. Each worker can hold one active order.</p>}
      {role === 'shopper' && orders.cop && <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 text-sm"><p>COP strikes: {orders.cop.strike_count} · {orders.cop.allowed ? 'Cash on Pickup available' : orders.cop.permanently_disabled ? 'Cash on Pickup permanently disabled' : 'Cash on Pickup disabled until '+localTime.format(new Date(orders.cop.disabled_until))}</p><p className="mt-1 text-xs text-gray-600">COP restrictions do not deactivate your Shopper account. Digital checkout will require an actual verified payment integration.</p></div>}
      {role === 'shopper' && orders.notifications.length > 0 && <details className="mb-4 rounded-lg border border-gray-200 bg-white p-4 text-sm"><summary className="cursor-pointer font-semibold">Order notifications ({orders.notifications.filter(function (entry) { return !entry.read_at; }).length} unread)</summary><ul className="mt-3 space-y-3">{orders.notifications.slice(0, 10).map(function (entry) { return <li key={entry.id}>Order #{entry.order_id} · {entry.message}{!entry.read_at && <button type="button" onClick={function () { markRead(entry.id); }} className="ml-3 text-xs font-semibold text-green-800 underline">Mark read</button>}</li>; })}</ul></details>}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <input type="search" aria-label="Search orders" value={search} onChange={function (event) { setSearch(event.target.value); }} placeholder="Search order or store..." className="flex-1 rounded-lg border border-gray-300 bg-white p-2.5 text-sm" />
        <select aria-label="Order status" value={status} onChange={function (event) { setStatus(event.target.value); }} className="rounded-lg border border-gray-300 bg-white p-2.5 text-sm"><option value="">All statuses</option>{Object.entries(labels).map(function ([value, label]) { return <option key={value} value={value}>{label}</option>; })}</select>
        <button type="button" onClick={orders.reload} className="rounded-lg border border-green-700 bg-white px-4 py-2 text-sm text-green-800">Refresh orders</button>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={upcoming} onChange={function (event) { setUpcoming(event.target.checked); }} />Upcoming scheduled orders</label>
      </div>
      {orders.loading && <p role="status" className="rounded-xl border border-gray-200 bg-white p-5 text-sm">Loading orders...</p>}
      {orders.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{orders.error}</p>}
      {!orders.loading && !orders.error && <div className="space-y-5">{filtered.map(function (order) { return <OrderCard key={order.order_id} order={order} role={role} workers={orders.workers} onSaved={saved} onFailure={failed} />; })}{filtered.length === 0 && <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600">No matching orders.</p>}</div>}
    </div>
  );
}
