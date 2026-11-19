import { useCallback, useEffect, useRef, useState } from 'react';
import { getPaymentSession, startPaymentSession } from '../../services/api';
import { hostedPaymentUrl, providerLabel } from '../../services/payments';

export default function OrderPayment({ order, onSaved, autoStart = false }) {
  const [payment, setPayment] = useState(order.payment_checkout);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const initialized = useRef(false);
  const perform = useCallback(async (start, redirect = false) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try {
      const result = start ? await startPaymentSession(order.order_id) : await getPaymentSession(order.order_id);
      setPayment(result.payment);
      if (result.payment.verified) onSaved?.('Sandbox payment confirmed.');
      const url = hostedPaymentUrl(result.payment.checkout_url, result.payment.provider ?? 'paymongo');
      if (redirect && url) window.location.assign(url);
    } catch (failure) { setError(failure.message); }
    finally { busy.current = false; setPending(false); }
  }, [onSaved, order.order_id]);
  useEffect(() => {
    if (order.payment_method !== 'digital' || order.payment_status === 'paid' || order.status !== 'waiting') return;
    let active = true;
    Promise.resolve().then(() => {
      if (!active || initialized.current) return;
      const returned = new URLSearchParams(window.location.search).get('payment_order') === String(order.order_id);
      if (!autoStart && !returned) return;
      initialized.current = true;
      perform(autoStart && payment?.status === 'pending');
    });
    return () => { active = false; };
  }, [autoStart, order.order_id, order.payment_method, order.payment_status, order.status, payment?.status, perform]);
  if (order.payment_method !== 'digital') return null;
  const provider = payment?.provider ?? (payment ? 'paymongo' : null);
  const paid = order.payment_status === 'paid' || payment?.status === 'paid';
  const url = hostedPaymentUrl(payment?.checkout_url, provider);
  const closed = ['expired', 'canceled'].includes(payment?.status);
  return <section className="mt-4 rounded-lg border border-gray-200 p-4 text-sm"><h3 className="font-semibold">{providerLabel(provider)} payment</h3><p className="mt-2">{paid ? (payment?.verified ? 'TEST payment verified. Preparation, QR/PIN verification and physical handover are still required.' : 'Payment is recorded, but trusted provider evidence requires review. Contact the store.') : closed ? 'Payment session ended. Refresh this order and cancel safely before a new checkout.' : 'Payment pending. Returning from the hosted page does not confirm payment.'}</p>
    {payment && <p className="mt-2">Status: {payment.status.replaceAll('_', ' ')} | Reservation deadline: {new Date(payment.expires_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>}
    {payment?.status === 'reconciliation_required' && <p className="mt-2">The original session needs reconciliation. Do not submit another order; contact the store if refresh cannot recover it.</p>}
    {payment?.last_error === 'late_payment_review_required' && <p className="mt-2">Late payment received. The canceled order remains closed; contact the store for payment review.</p>}
    {!paid && order.status === 'waiting' && <div className="mt-3 flex flex-wrap gap-3">{url ? <a href={url} className="rounded-lg bg-green-700 px-4 py-2 text-white">Pay with {providerLabel(provider)}</a> : !closed && <button type="button" disabled={pending} onClick={() => perform(true, true)} className="rounded-lg bg-green-700 px-4 py-2 text-white disabled:opacity-50">{pending ? 'Preparing payment...' : 'Pay with '+providerLabel(provider)}</button>}<button type="button" disabled={pending} onClick={() => perform(false)} className="rounded-lg border border-gray-300 px-4 py-2">Refresh payment status</button></div>}
    {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}</section>;
}
