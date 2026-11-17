import { useEffect, useRef, useState } from 'react';
import { createCheckoutOrder, findCheckoutAttempt, getCheckoutQuote, getPickupHours } from '../../services/api';
import usePaymentOptions from '../../hooks/usePaymentOptions';
import OrderPayment from '../orders/OrderPayment';
import { OrderDocumentDialog } from '../orders/OrderReceipt';
import { clearCheckoutAttempt, readCheckoutAttempt, saveCheckoutAttempt } from '../../services/checkout';
import { checkoutPickupWindows, checkoutWindowFits, pickupWindowLabel, pickupWindowValue } from '../../services/pickup-scheduling';

const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const localTime = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });

export default function ShopperCheckout(props) {
  return <CheckoutDialog key={props.userId + ':' + props.cart.store_id} {...props} />;
}

function CheckoutDialog({ cart, userId, onPlaced, onClose }) {
  const dialog = useRef(null);
  const submitting = useRef(false);
  const key = useRef(null);
  const [selection, setSelection] = useState({ pickup_date: null, pickup_start: '', pickup_end: '' });
  const [hoursResponse, setHoursResponse] = useState({ key: '', data: null, error: '' });
  const [hoursVersion, setHoursVersion] = useState(0);
  const [review, setReview] = useState(null);
  const [reviewCart, setReviewCart] = useState(null);
  const [order, setOrder] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const [method, setMethod] = useState('cash_on_pickup');
  const paymentOptions = usePaymentOptions(cart.store_id);
  const hoursKey = cart.store_id + ':' + (selection.pickup_date ?? 'default') + ':' + hoursVersion;
  const hoursLoading = selection.pickup_date !== '' && hoursResponse.key !== hoursKey;
  const hours = hoursLoading || selection.pickup_date === '' ? null : hoursResponse.data;
  const hoursError = hoursLoading || selection.pickup_date === '' ? '' : hoursResponse.error;
  const windows = checkoutPickupWindows(hours);
  const selectedWindow = selection.pickup_start ? pickupWindowValue(selection) : '';
  const selectionValid = checkoutWindowFits(hours, selection.pickup_start, selection.pickup_end);

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
        if (saved.payment) setMethod(saved.payment.payment_method === 'digital' ? saved.payment.payment_channel : 'cash_on_pickup');
        try {
          const result = await findCheckoutAttempt(saved.key, { signal: controller.signal });
          if (active) { setOrder(result.order); onPlaced(result.order, saved.key, cart); }
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
    if (loading || uncertain || order || selection.pickup_date === '' || hoursResponse.key === hoursKey) return;
    const controller = new AbortController();
    let active = true;
    getPickupHours(cart.store_id, selection.pickup_date, { signal: controller.signal }).then(function (result) {
      if (!active) return;
      if (result.store_id !== cart.store_id || !result.hours || !Array.isArray(result.hours.windows)
        || !/^\d{4}-\d{2}-\d{2}$/.test(result.hours.date) || !/^\d{4}-\d{2}-\d{2}$/.test(result.hours.today)
        || (selection.pickup_date !== null && result.hours.date !== selection.pickup_date)) throw new Error('Pickup windows could not be verified. Please retry.');
      const resolvedKey = cart.store_id + ':' + result.hours.date + ':' + hoursVersion;
      setHoursResponse({ key: resolvedKey, data: result.hours, error: '' });
      if (selection.pickup_date === null) setSelection((current) => ({ ...current, pickup_date: result.hours.date }));
      if (selection.pickup_start && !checkoutWindowFits(result.hours, selection.pickup_start, selection.pickup_end)) {
        setSelection((current) => ({ ...current, pickup_start: '', pickup_end: '' }));
        setReview(null); setReviewCart(null);
        setError('Your pickup window is no longer available. Choose another window and review again.');
      }
    }).catch(function (failure) {
      if (active && failure.name !== 'AbortError') setHoursResponse({ key: hoursKey, data: null, error: Object.values(failure.errors ?? {}).flat().join(' ') || failure.message });
    });
    return function () { active = false; controller.abort(); };
  }, [cart.store_id, selection, hoursVersion, hoursKey, hoursResponse.key, loading, uncertain, order]);

  useEffect(() => {
    const refresh = () => {
      if (submitting.current || loading || uncertain || order) return;
      setReview(null); setReviewCart(null); setHoursVersion((n) => n + 1);
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [loading, uncertain, order]);

  function refreshWindows() {
    if (submitting.current || loading || uncertain) return;
    setReview(null); setReviewCart(null); setHoursVersion((n) => n + 1);
  }

  function staleSchedule(failure) {
    if (uncertain || ![409, 422].includes(failure.status)) return;
    setReview(null); setReviewCart(null);
    if (['pickup_date', 'pickup_start', 'pickup_end'].some((field) => failure.errors?.[field])) setSelection((current) => ({ ...current, pickup_start: '', pickup_end: '' }));
    setHoursVersion((n) => n + 1);
  }

  function choose(field, value) {
    if (loading || pending || uncertain) return;
    if (key.current) {
      try { clearCheckoutAttempt(sessionStorage, userId, key.current); }
      catch (failure) { setError(failure.message); return; }
    }
    key.current = null;
    setReview(null); setReviewCart(null); setError('');
    if (field === 'payment_method') { setMethod(value); return; }
    setSelection(function (current) {
      if (field === 'pickup_date') return { pickup_date: value, pickup_start: '', pickup_end: '' };
      if (field === 'pickup_window') {
        const window = windows.find((option) => pickupWindowValue(option) === value);
        return { ...current, pickup_start: window?.pickup_start ?? '', pickup_end: window?.pickup_end ?? '' };
      }
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
          setOrder(recovered.order); setUncertain(false); onPlaced(recovered.order, key.current, cart); return;
        } catch (failure) {
          if (failure.status !== 404) throw failure;
          clearCheckoutAttempt(sessionStorage, userId, key.current);
          key.current = null; setUncertain(false);
          setReviewCart(null); setHoursVersion((n) => n + 1);
          setError('No original order was found. Select an available pickup window and review again.');
          return;
        }
      }
      if (!selectionValid) { setError('Select an available pickup window before reviewing.'); return; }
      const selectedCart = { ...cart, items: cart.items.map((item) => ({ ...item })), ...selection, payment_method: method === 'cash_on_pickup' ? 'cash_on_pickup' : 'digital',
        ...(method !== 'cash_on_pickup' ? { payment_channel: method } : {}) };
      const result = await getCheckoutQuote(selectedCart);
      setReview(result); setReviewCart(selectedCart); setUncertain(false);
    } catch (failure) {
      setError(Object.values(failure.errors ?? {}).flat().join(' ') || failure.message);
      staleSchedule(failure);
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
      const result = await createCheckoutOrder(reviewCart, review.quote_token, key.current);
      setOrder(result.order); setUncertain(false); onPlaced(result.order, key.current, cart);
    } catch (failure) {
      if (started && (!failure.status || failure.status >= 500)) {
        setUncertain(true);
        setError('The result is uncertain. Check the original order before changing the schedule or retrying. The saved checkout key prevents a duplicate order.');
      } else {
        setError(Object.values(failure.errors ?? {}).flat().join(' ') || failure.message);
        staleSchedule(failure);
      }
    } finally { submitting.current = false; setPending(false); }
  }

  return <>{showSummary && order && <OrderDocumentDialog orderId={order.order_id} role="shopper" summary onClose={() => { setShowSummary(false); dialog.current.showModal(); }} />}<dialog aria-labelledby="checkout-dialog-title" ref={dialog} onCancel={function (event) { event.preventDefault(); if (!pending && !uncertain) onClose(); }} className="fixed inset-0 m-auto max-h-[90vh] w-[min(95vw,640px)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-xl backdrop:bg-black/40">
    <h2 id="checkout-dialog-title" className="text-xl font-bold">Checkout</h2>
    {order ? <div className="mt-5"><p role="status" className="rounded-lg bg-green-50 p-4 text-green-800">{order.order_reference} is recorded at {order.store_name}.</p><p className="mt-3 text-sm">Status: {order.status}. Payment: {order.payment_status}. Total: {money.format(order.total_centavos / 100)}.</p><p className="mt-3 text-sm">{order.reservation_status === 'active' ? (order.payment_method === 'digital' ? 'Items are reserved pending sandbox payment. Complete payment before preparation; track progress in My Orders.' : 'Items are reserved. Track preparation in My Orders. Pay the store cashier before verified physical handover.') : 'This existing order has already been completed or canceled. See My Orders for details.'}</p>{order.pickup_window_start_at && order.pickup_window_end_at && <p className="mt-3 text-sm font-semibold">Pickup: {localTime.format(new Date(order.pickup_window_start_at))} to {localTime.format(new Date(order.pickup_window_end_at))}</p>}<OrderPayment order={order} /><button type="button" onClick={() => { dialog.current.close(); setShowSummary(true); }} className="mr-3 mt-5 rounded-lg border border-green-700 px-4 py-2 text-green-800">View / Print Order Summary</button><button type="button" onClick={onClose} className="mt-5 rounded-lg bg-green-700 px-4 py-2 text-white">Done</button></div> : <>
      {loading && <p role="status" className="mt-4 text-sm">Checking any previous checkout attempt...</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <fieldset disabled={loading || pending || uncertain} className="mt-5 rounded-lg border border-gray-200 p-4 text-sm"><legend className="font-semibold">Payment method</legend><label className="mt-3 flex items-center gap-2"><input type="radio" name="payment_method" value="cash_on_pickup" checked={method === 'cash_on_pickup'} onChange={() => choose('payment_method', 'cash_on_pickup')} />Cash on Pickup - Maximum PHP 1,500</label><label className="mt-2 flex items-center gap-2"><input type="radio" name="payment_method" value="wallet" checked={method === 'wallet'} disabled={!paymentOptions.available || !paymentOptions.channels.some(channel => channel !== 'card')} onChange={() => choose('payment_method', 'wallet')} />Digital / E-wallet {paymentOptions.available ? '(sandbox)' : '- unavailable'}</label><label className="mt-2 flex items-center gap-2"><input type="radio" name="payment_method" value="card" checked={method === 'card'} disabled={!paymentOptions.available || !paymentOptions.channels.includes('card')} onChange={() => choose('payment_method', 'card')} />Debit / Credit Card {paymentOptions.available && paymentOptions.channels.includes('card') ? '(sandbox)' : '- unavailable'}</label><p className="mt-3 text-xs text-gray-600">{paymentOptions.loading ? 'Checking available payment channels...' : paymentOptions.reason} A future pickup window is required for every payment method.</p></fieldset>
      <form noValidate={uncertain} onSubmit={reviewOrder} className="mt-5 space-y-3">
        <fieldset disabled={loading || pending || uncertain} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm" htmlFor="checkout-pickup-date">Pickup date<input id="checkout-pickup-date" aria-describedby="checkout-window-status" aria-invalid={Boolean(hoursError)} required type="date" min={hoursResponse.data?.today} value={selection.pickup_date ?? ''} onChange={(event) => choose('pickup_date', event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-2" /></label>
          <label className="text-sm" htmlFor="checkout-pickup-window">Pickup window<select aria-label="Pickup window" id="checkout-pickup-window" required disabled={!hours || windows.length === 0} aria-describedby="checkout-window-help checkout-window-status" aria-invalid={Boolean(hoursError)} value={selectedWindow} onChange={(event) => choose('pickup_window', event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2"><option value="">Select a pickup window</option>{windows.map((window) => <option key={pickupWindowValue(window)} value={pickupWindowValue(window)}>{pickupWindowLabel(window)}</option>)}</select></label>
        </fieldset>
        <p id="checkout-window-help" className="text-sm text-gray-600">Choose a pickup window. Check My Orders for your order status.</p>
        <div id="checkout-window-status" aria-live="polite">
          {!loading && !uncertain && hoursLoading && <p role="status" className="text-sm text-gray-600">Loading pickup windows...</p>}
          {selection.pickup_date === '' && <p className="text-sm text-gray-600">Choose a pickup date to see its windows.</p>}
          {hours && windows.length === 0 && <p className="text-sm text-gray-600">No pickup windows available for this date. Choose another date.</p>}
          {hoursError && <p role="alert" className="text-sm text-red-700">{hoursError}<button type="button" disabled={loading || pending || uncertain} onClick={refreshWindows} className="ml-2 underline">Retry pickup windows</button></p>}
        </div>
        <button disabled={loading || pending || (!uncertain && !selectionValid)} className="rounded-lg border border-green-700 px-4 py-2 text-sm text-green-800">{uncertain ? 'Check original order and refresh review' : 'Review current prices and pickup schedule'}</button>
      </form>
      {review && <div className="mt-5 border-t border-gray-200 pt-4"><h3 className="font-semibold">{review.quote.store.store_name}</h3><p className="text-sm text-gray-600">{review.quote.store.address}</p><p className="mt-3 text-sm font-semibold">Pickup: {localTime.format(new Date(review.quote.pickup_window_start_at))}–{localTime.format(new Date(review.quote.pickup_window_end_at))}</p><p className="mt-1 text-xs text-gray-600">{review.quote.payment_method === 'digital' ? 'The store-approved 24/48-hour prepaid holding policy applies after the order is Ready. Collect during store hours.' : 'COP claiming deadline: ' + localTime.format(new Date(review.quote.cop_claim_deadline_at)) + '. Late claiming requires a Ready order and the store to be open.'}</p><ul className="mt-3 divide-y divide-gray-100">{review.quote.items.map(function (item) { return <li key={item.store_inventory_id} className="py-3 text-sm"><p className="font-semibold">{item.product_name} {item.size}</p><p>{item.quantity} × {money.format(item.unit_price_centavos / 100)} = {money.format(item.line_total_centavos / 100)}</p></li>; })}</ul><p className="mt-3 text-sm">Groceries: {money.format(review.quote.subtotal_centavos / 100)}</p><p className="mt-2 text-sm">Service fee: {money.format(review.quote.service_fee_centavos / 100)}. A service-fee policy remains pending supermarket approval.</p><p className="mt-3 text-lg font-bold">Total: {money.format(review.quote.total_centavos / 100)}</p><p className="mt-2 text-sm">{review.quote.payment_method === 'digital' ? 'Sandbox digital payment. No COP maximum applies. Payment remains pending until trusted provider confirmation.' : 'Cash on Pickup - Maximum PHP 1,500 - Payment remains unpaid at Checkout.'}</p></div>}
      <div className="mt-6 flex flex-wrap gap-3"><button type="button" disabled={pending || loading || !review || uncertain} onClick={placeOrder} className="rounded-lg bg-green-700 px-4 py-2.5 text-sm text-white disabled:opacity-50">{pending ? 'Checking...' : 'Confirm / Place Order'}</button><button type="button" disabled={pending || loading || uncertain} onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm disabled:opacity-50">Back to cart</button></div>
    </>}
  </dialog></>;
}
