import { useRef, useState } from 'react';
import { confirmOrderResale, requestOrderRefundReview, rescheduleOrder } from '../../services/api';

const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-sm';
const buttonClass = 'rounded-lg border border-amber-500 px-4 py-2 text-sm text-amber-900 disabled:opacity-50';

export default function OrderResolution({ order, onSaved, onFailure }) {
  const [selection, setSelection] = useState({ pickup_date: '', pickup_start: '', pickup_end: '' });
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const canReschedule = ['waiting', 'preparing', 'ready_for_pickup'].includes(order.status) && ['awaiting_preparation', 'claimable'].includes(order.claim_status) && !order.pickup.verified_at;
  const canResell = order.claim_status === 'no_show' && order.reservation_status === 'active' && order.payment_status === 'unpaid';
  const needsRefundReview = order.claim_status === 'unclaimed_pending_resolution' && order.refund_status === 'pending_decision';

  function choose(field, value) { setSelection(function (current) { return { ...current, [field]: value }; }); }
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
    {canReschedule && <form onSubmit={function (event) { perform(event, 'reschedule'); }} className="mt-4 space-y-3"><p className="text-xs text-gray-600">Approve a future pickup window within this store's operating hours. A Ready order receives a replacement credential; the old one becomes invalid.</p><fieldset disabled={pending} className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">New pickup date<input required type="date" value={selection.pickup_date} onChange={function (event) { choose('pickup_date', event.target.value); }} className={inputClass} /></label><label className="text-sm">From (Philippine time)<input required type="time" value={selection.pickup_start} onChange={function (event) { choose('pickup_start', event.target.value); }} className={inputClass} /></label><label className="text-sm">Until (Philippine time)<input required type="time" value={selection.pickup_end} onChange={function (event) { choose('pickup_end', event.target.value); }} className={inputClass} /></label></div><label className="block text-sm">Approval reason<input required maxLength="500" value={reason} onChange={function (event) { setReason(event.target.value); }} className={inputClass} /></label><button className={buttonClass}>Approve reschedule</button></fieldset></form>}
    {canResell && <form onSubmit={function (event) { perform(event, 'resale'); }} className="mt-4 space-y-3"><p className="text-sm">Inspect the goods before releasing their reservation. Damaged, spoiled, or missing goods must remain under an authorized stock reconciliation process.</p><fieldset disabled={pending} className="space-y-3"><label className="flex gap-2 text-sm"><input required type="checkbox" />Every reserved item is confirmed suitable for resale.</label><label className="block text-sm">Physical inspection / disposition reason<input required maxLength="500" value={reason} onChange={function (event) { setReason(event.target.value); }} className={inputClass} /></label><button className={buttonClass}>Record resale disposition and release reservation</button></fieldset></form>}
    {needsRefundReview && <form onSubmit={function (event) { perform(event, 'refund'); }} className="mt-4 space-y-3"><p className="text-sm">The payment and reserved goods remain held. This records a refund review request; it does not transfer money, record a successful refund, or authorize resale.</p><fieldset disabled={pending} className="space-y-3"><label className="block text-sm">Reconciliation / refund review note<input required maxLength="500" value={reason} onChange={function (event) { setReason(event.target.value); }} className={inputClass} /></label><button className={buttonClass}>Request refund review</button></fieldset></form>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </details>;
}
