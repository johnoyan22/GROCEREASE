import { useRef, useState } from 'react';
import { getPaymentSession, startPaymentSession } from '../../services/api';

export default function OrderPayment({ order, onSaved }) {
  const [payment, setPayment] = useState(order.payment_checkout);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  if (order.payment_method !== 'digital') return null;
  async function perform(start) {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try {
      const result = start ? await startPaymentSession(order.order_id) : await getPaymentSession(order.order_id);
      setPayment(result.payment);
      if (result.payment.status === 'paid') onSaved?.('Sandbox payment confirmed.');
    } catch (failure) { setError(failure.message); }
    finally { busy.current = false; setPending(false); }
  }
  return <section className="mt-4 rounded-lg border border-gray-200 p-4 text-sm"><h3 className="font-semibold">Sandbox payment</h3><p className="mt-2">{order.payment_status === 'paid' ? 'Paid in test mode. Preparation and verified physical handover are still required.' : 'Payment pending. Provider failures or a return from the payment page do not confirm payment.'}</p>{payment && <p className="mt-2">Attempt: {payment.status.replaceAll('_', ' ')} · Reservation deadline: {new Date(payment.expires_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>}{order.payment_status === 'unpaid' && order.status === 'waiting' && <div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={pending} onClick={() => perform(true)} className="rounded-lg bg-green-700 px-4 py-2 text-white disabled:opacity-50">Prepare / recover sandbox checkout</button><button type="button" disabled={pending} onClick={() => perform(false)} className="rounded-lg border border-gray-300 px-4 py-2">Refresh payment status</button>{payment?.checkout_url && <a href={payment.checkout_url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-green-700 px-4 py-2 text-green-800">Open PayMongo sandbox checkout</a>}</div>}{error && <p role="alert" className="mt-3 text-red-700">{error}</p>}</section>;
}
