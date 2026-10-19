import { useEffect, useRef, useState } from 'react';
import { confirmOrderResale, getSupervisorPickupHours, requestOrderRefundReview, rescheduleOrder } from '../../services/api';
import { pickupWindowBounds, pickupWindowFits } from '../../services/pickup-scheduling';

const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-sm';
const buttonClass = 'rounded-lg border border-amber-500 px-4 py-2 text-sm text-amber-900 disabled:opacity-50';

export default function OrderResolution({ order, onSaved, onFailure }) {
  const [selection, setSelection] = useState({ pickup_date: '', pickup_start: '', pickup_end: '' });
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [hours, setHours] = useState(null);
  const [hoursError, setHoursError] = useState('');
  const busy = useRef(false);
  const canReschedule = ['waiting', 'preparing', 'ready_for_pickup'].includes(order.status) && ['awaiting_preparation', 'claimable'].includes(order.claim_status) && !order.pickup.verified_at;
  const canResell = order.claim_status === 'no_show' && order.reservation_status === 'active' && order.payment_status === 'unpaid';
  const needsRefundReview = order.claim_status === 'unclaimed_pending_resolution' && order.refund_status === 'pending_decision';
  const bounds = pickupWindowBounds(hours, selection.pickup_start);

  useEffect(function () {
    if (!selection.pickup_date || !canReschedule) return;
    const controller = new AbortController();
    let active = true;
    getSupervisorPickupHours(selection.pickup_date, { signal: controller.signal }).then(function (result) {
      if (active) {
        if (result.store_id !== order.store_id) { setHours(null); setHoursError('Your store assignment changed. Refresh Orders.'); return; }
        setHours(result.hours); setHoursError('');
      }
    }).catch(function (failure) {
      if (active && failure.name !== 'AbortError') { setHours(null); setHoursError(failure.message); }
    });
    return function () { active = false; controller.abort(); };
  }, [canReschedule, order.store_id, selection.pickup_date]);

  function choose(field, value) {
    if (field === 'pickup_date') { setHours(null); setHoursError(''); }
    setSelection(function (current) {
      if (field === 'pickup_date') return { pickup_date: value, pickup_start: '', pickup_end: '' };
      return { ...current, [field]: value };
    });
  }
  async function perform(event, action) {
    event.preventDefault();
    if (busy.current) return;
    if (action === 'resale' && !window.confirm('Confirm that every reserved item was physically checked and is suitable for resale. This releases its reservation and cancels the unclaimed COP order.')) return;
    busy.current = true; setPending(true); setError('');
    try {
      let result;
      if (action === 'reschedule') result = await rescheduleOrder(order.order_id, selection, reason.trim());
      if (action === 'resale') result = await confirmOrderResale(order.order_id, reason.trim());
      if (action === 'refund') result = await requestOrderRefundReview(order.order_id, reason.trim());
      onSaved(result.message);
    } catch (failure) { setError(Object.values(failure.errors ?? {}).flat().join(' ') || failure.message); onFailure(failure); }
    finally { busy.current = false; setPending(false); }
  }
  if (!canReschedule && !canResell && !needsRefundReview) return null;
  return <details className="mt-4 rounded-lg border border-gray-200 p-4"><summary className="cursor-pointer text-sm font-semibold">Schedule / unclaimed-order review</summary>
    {canReschedule && <form onSubmit={function (event) { perform(event, 'reschedule'); }} className="mt-4 space-y-3"><p className="text-xs text-gray-600">Review or approve a future window within both store and pickup-service hours. Enter the existing window to reconfirm it if still valid. A Ready order receives a replacement credential. Expired orders and strikes require reconciliation.</p><fieldset disabled={pending} className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">New pickup date<input required type="date" value={selection.pickup_date} onChange={function (event) { choose('pickup_date', event.target.value); }} className={inputClass} /></label><label className="text-sm">From (Philippine time)<input required disabled={!bounds} type="time" min={bounds?.startMin} max={bounds?.startMax} value={selection.pickup_start} onChange={function (event) { choose('pickup_start', event.target.value); }} className={inputClass} /></label><label className="text-sm">Until (Philippine time)<input required disabled={!bounds} type="time" min={bounds?.endMin} max={bounds?.endMax} value={selection.pickup_end} onChange={function (event) { choose('pickup_end', event.target.value); }} className={inputClass} /></label></div><label className="block text-sm">Approval reason<input required maxLength="500" value={reason} onChange={function (event) { setReason(event.target.value); }} className={inputClass} /></label>{hours && <p className="text-xs text-gray-600">Pickup service: {hours.opens_at}–{hours.closes_at}; earliest available start {hours.earliest_start_at}. Store closes {hours.store_closes_at} (Asia/Manila).</p>}{hoursError && <p role="alert" className="text-xs text-red-700">{hoursError}</p>}<button disabled={!pickupWindowFits(hours, selection.pickup_start, selection.pickup_end)} className={buttonClass}>Approve reschedule</button></fieldset></form>}
    {canResell && <form onSubmit={function (event) { perform(event, 'resale'); }} className="mt-4 space-y-3"><p className="text-sm">Inspect the goods before releasing their reservation. Damaged, spoiled, or missing goods must remain under an authorized stock reconciliation process.</p><fieldset disabled={pending} className="space-y-3"><label className="flex gap-2 text-sm"><input required type="checkbox" />Every reserved item is confirmed suitable for resale.</label><label className="block text-sm">Physical inspection / disposition reason<input required maxLength="500" value={reason} onChange={function (event) { setReason(event.target.value); }} className={inputClass} /></label><button className={buttonClass}>Record resale disposition and release reservation</button></fieldset></form>}
    {needsRefundReview && <form onSubmit={function (event) { perform(event, 'refund'); }} className="mt-4 space-y-3"><p className="text-sm">The payment and reserved goods remain held. This records a refund review request; it does not transfer money, record a successful refund, or authorize resale.</p><fieldset disabled={pending} className="space-y-3"><label className="block text-sm">Reconciliation / refund review note<input required maxLength="500" value={reason} onChange={function (event) { setReason(event.target.value); }} className={inputClass} /></label><button className={buttonClass}>Request refund review</button></fieldset></form>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </details>;
}
