import { useEffect, useRef, useState } from 'react';
import { createCopOrder, findCheckoutAttempt, getCheckoutQuote, getPickupHours } from '../../services/api';
import { clearCheckoutAttempt, readCheckoutAttempt, saveCheckoutAttempt } from '../../services/checkout';
import { pickupWindowBounds, pickupWindowFits } from '../../services/pickup-scheduling';

const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const localTime = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });
const today = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Manila' });

export default function ShopperCheckout({ cart, userId, onPlaced, onClose }) {
  const dialog = useRef(null);
  const submitting = useRef(false);
  const key = useRef(null);
  const [selection, setSelection] = useState({ pickup_date: today.format(new Date()), pickup_start: '', pickup_end: '' });
  const [hours, setHours] = useState(null);
  const [hoursError, setHoursError] = useState('');
  const [review, setReview] = useState(null);
  const [reviewCart, setReviewCart] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const bounds = pickupWindowBounds(hours, selection.pickup_start);

  useEffect(function () {
    const element = dialog.current;
    element.showModal();
    const controller = new AbortController();
    let active = true;
    async function recover() {
      try {
        const saved = readCheckoutAttempt(sessionStorage, userId, cart);
        if (!saved) return;
        key.current = saved.key;
        setSelection(saved.schedule);
        try {
          const result = await findCheckoutAttempt(saved.key, { signal: controller.signal });
          if (active) { setOrder(result.order); onPlaced(result.order, saved.key); }
        } catch (failure) {
          if (failure.status !== 404) throw failure;
          if (active) { clearCheckoutAttempt(sessionStorage, userId, saved.key); key.current = null; }
        }
      } catch (failure) {
        if (active && failure.name !== 'AbortError') { setError(failure.message); setUncertain(true); }
      } finally { if (active) setLoading(false); }
    }
    recover();
    return function () { active = false; controller.abort(); element.close(); };
  }, [cart, userId, onPlaced]);

  useEffect(function () {
    if (!selection.pickup_date) return;
    const controller = new AbortController();
    let active = true;
    getPickupHours(cart.store_id, selection.pickup_date, { signal: controller.signal }).then(function (result) {
      if (active) { setHours(result.hours); setHoursError(''); }
    }).catch(function (failure) { if (active && failure.name !== 'AbortError') { setHours(null); setHoursError(failure.message); } });
    return function () { active = false; controller.abort(); };
  }, [cart.store_id, selection.pickup_date]);

  function choose(field, value) {
    if (pending || uncertain) return;
    if (key.current) {
      try { clearCheckoutAttempt(sessionStorage, userId, key.current); }
      catch (failure) { setError(failure.message); return; }
    }
    key.current = null;
    setReview(null); setReviewCart(null); setError('');
    if (field === 'pickup_date') { setHours(null); setHoursError(''); }
    setSelection(function (current) {
      if (field === 'pickup_date') return { pickup_date: value, pickup_start: '', pickup_end: '' };
      return { ...current, [field]: value };
    });
  }

  async function reviewOrder(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true; setPending(true); setError(''); setReview(null);
    try {
      if (key.current) {
        try {
          const recovered = await findCheckoutAttempt(key.current);
          setOrder(recovered.order); setUncertain(false); onPlaced(recovered.order, key.current); return;
        } catch (failure) {
          if (failure.status !== 404) throw failure;
          clearCheckoutAttempt(sessionStorage, userId, key.current);
          key.current = null; setUncertain(false);
        }
      }
      const selectedCart = { ...cart, ...selection };
      const result = await getCheckoutQuote(selectedCart);
      setReview(result); setReviewCart(selectedCart); setUncertain(false);
    } catch (failure) {
      setError(Object.values(failure.errors ?? {}).flat().join(' ') || failure.message);
    } finally { submitting.current = false; setPending(false); }
  }

  async function placeOrder() {
    if (submitting.current || !review || !reviewCart) return;
    submitting.current = true; setPending(true); setError('');
    let started = false;
    try {
      if (!key.current) key.current = crypto.randomUUID();
      saveCheckoutAttempt(sessionStorage, userId, reviewCart, key.current);
      started = true;
      const result = await createCopOrder(reviewCart, review.quote_token, key.current);
      setOrder(result.order); setUncertain(false); onPlaced(result.order, key.current);
    } catch (failure) {
      if (started && (!failure.status || failure.status >= 500)) {
        setUncertain(true);
        setError('The result is uncertain. Check the original order before changing the schedule or retrying. The saved checkout key prevents a duplicate order.');
      } else {
        setError(Object.values(failure.errors ?? {}).flat().join(' ') || failure.message);
        if ([409, 422].includes(failure.status)) setReview(null);
      }
    } finally { submitting.current = false; setPending(false); }
  }

  return <dialog ref={dialog} onCancel={function (event) { event.preventDefault(); if (!pending && !uncertain) onClose(); }} className="fixed inset-0 m-auto max-h-[90vh] w-[min(95vw,640px)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-xl backdrop:bg-black/40">
    <h2 className="text-xl font-bold">Review Cash on Pickup order</h2>
    {order ? <div className="mt-5"><p role="status" className="rounded-lg bg-green-50 p-4 text-green-800">Order #{order.order_id} is recorded at {order.store_name}.</p><p className="mt-3 text-sm">Status: {order.status}. Payment: {order.payment_status}. Total: {money.format(order.total_centavos / 100)}.</p><p className="mt-3 text-sm">{order.reservation_status === 'active' ? 'Items are reserved. Track preparation in My Orders. Pay the store cashier before verified physical handover.' : 'This existing order has already been completed or canceled. See My Orders for details.'}</p><button type="button" onClick={onClose} className="mt-5 rounded-lg bg-green-700 px-4 py-2 text-white">Done</button></div> : <>
      {loading && <p role="status" className="mt-4 text-sm">Checking any previous checkout attempt...</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <form onSubmit={reviewOrder} className="mt-5 space-y-3">
        <fieldset disabled={loading || pending || uncertain} className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Pickup date<input required type="date" min={today.format(new Date())} value={selection.pickup_date} onChange={function (event) { choose('pickup_date', event.target.value); }} className="mt-1 w-full rounded-lg border border-gray-300 p-2" /></label>
          <label className="text-sm">From (Philippine time)<input required disabled={!bounds} type="time" min={bounds?.startMin} max={bounds?.startMax} value={selection.pickup_start} onChange={function (event) { choose('pickup_start', event.target.value); }} className="mt-1 w-full rounded-lg border border-gray-300 p-2" /></label>
          <label className="text-sm">Until (Philippine time)<input required disabled={!bounds} type="time" min={bounds?.endMin} max={bounds?.endMax} value={selection.pickup_end} onChange={function (event) { choose('pickup_end', event.target.value); }} className="mt-1 w-full rounded-lg border border-gray-300 p-2" /></label>
        </fieldset>
        {hours && <p className="text-sm text-gray-600">Pickup service on {hours.date}: {hours.opens_at}–{hours.closes_at}. Earliest available start: {hours.earliest_start_at}. Store hours: {hours.store_opens_at}–{hours.store_closes_at} (Asia/Manila). Choose a future window within pickup-service hours.</p>}
        {hoursError && <p role="alert" className="text-sm text-red-700">{hoursError}</p>}
        <button disabled={loading || pending || (!uncertain && !pickupWindowFits(hours, selection.pickup_start, selection.pickup_end))} className="rounded-lg border border-green-700 px-4 py-2 text-sm text-green-800">{uncertain ? 'Check original order and refresh review' : 'Review current prices and pickup schedule'}</button>
      </form>
      {review && <div className="mt-5 border-t border-gray-200 pt-4"><h3 className="font-semibold">{review.quote.store.store_name}</h3><p className="text-sm text-gray-600">{review.quote.store.address}</p><p className="mt-3 text-sm font-semibold">Pickup: {localTime.format(new Date(review.quote.pickup_window_start_at))}–{localTime.format(new Date(review.quote.pickup_window_end_at))}</p><p className="mt-1 text-xs text-gray-600">COP claiming deadline: {localTime.format(new Date(review.quote.cop_claim_deadline_at))}. Late claiming requires a Ready order and the store to be open.</p><ul className="mt-3 divide-y divide-gray-100">{review.quote.items.map(function (item) { return <li key={item.store_inventory_id} className="py-3 text-sm"><p className="font-semibold">{item.product_name} {item.size}</p><p>{item.quantity} × {money.format(item.unit_price_centavos / 100)} = {money.format(item.line_total_centavos / 100)}</p></li>; })}</ul><p className="mt-3 text-sm">Groceries: {money.format(review.quote.subtotal_centavos / 100)}</p><p className="mt-2 text-sm">Service fee: {money.format(review.quote.service_fee_centavos / 100)}. A service-fee policy remains pending supermarket approval.</p><p className="mt-3 text-lg font-bold">Total: {money.format(review.quote.total_centavos / 100)}</p><p className="mt-2 text-sm">Cash on Pickup · Maximum ₱1,500 · Payment remains unpaid at Checkout.</p></div>}
      <div className="mt-6 flex flex-wrap gap-3"><button type="button" disabled={pending || loading || !review || uncertain} onClick={placeOrder} className="rounded-lg bg-green-700 px-4 py-2.5 text-sm text-white disabled:opacity-50">{pending ? 'Checking...' : 'Place unpaid COP order'}</button><button type="button" disabled={pending || loading || uncertain} onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm disabled:opacity-50">Back to cart</button></div>
    </>}
  </dialog>;
}
