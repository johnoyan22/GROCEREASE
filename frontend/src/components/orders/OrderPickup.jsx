import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { getOrderPickup } from '../../services/api';

const buttonClass = 'rounded-lg bg-green-700 px-4 py-2 text-sm text-white disabled:opacity-50';
const localTime = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });

export default function OrderPickup({ order, role, onOpenPickup, onFailure }) {
  const [credential, setCredential] = useState(null);
  const [qrImage, setQrImage] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const pickup = order.pickup;

  useEffect(function () {
    if (!credential) return;
    const remaining = new Date(credential.expires_at).getTime() - Date.now();
    const timer = setTimeout(function () { setCredential(null); setQrImage(''); }, Math.max(0, Math.min(remaining, 2147483647)));
    return function () { clearTimeout(timer); };
  }, [credential]);

  async function perform(action, event) {
    event?.preventDefault();
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try {
      let result;
      if (action === 'show') {
        result = await getOrderPickup(order.order_id);
        setCredential(result.credential); setQrImage('');
        if (!result.credential) setError('A usable pickup credential is unavailable. Contact the store if the claim deadline passed.');
        else {
          try { setQrImage(await QRCode.toDataURL(result.credential.qr_token, { width: 240, margin: 4 })); }
          catch { setError('QR rendering is unavailable. You can still present the pickup PIN.'); }
        }
        return;
      }
    } catch (failure) { setError(Object.values(failure.errors ?? {}).flat().join(' ') || failure.message); onFailure(failure); }
    finally { busy.current = false; setPending(false); }
  }

  if (!pickup || !['shopper', 'supervisor'].includes(role)) return null;
  const claimable = order.status === 'ready_for_pickup' && order.claim_status === 'claimable' && !order.pickup_schedule_review_required;
  return <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
    <p className="text-sm">Claim state: <strong>{order.claim_status?.replaceAll('_', ' ')}</strong> · Claimant: <strong>{pickup.verified_at ? pickup.claimant_name : 'Not yet checked'}</strong> · Handover: <strong>{pickup.handed_over_at ? 'Recorded' : 'Pending'}</strong></p>
    {order.claim_expires_at && <p className="text-xs text-gray-600">Claim deadline: {localTime.format(new Date(order.claim_expires_at))} (Philippine time). Store pickup hours also apply.</p>}
    {role === 'shopper' && claimable && <div className="space-y-3"><button type="button" disabled={pending} onClick={function () { perform('show'); }} className={buttonClass}>Show QR / pickup PIN</button>{credential && <div className="rounded-lg bg-green-50 p-4"><p className="text-sm">{order.order_reference} · One-time pickup credential</p>{qrImage && <img src={qrImage} alt={'Pickup QR code for order '+order.order_id} width="240" height="240" className="mt-3" />}<p className="my-3 font-mono text-3xl tracking-widest">{credential.pin}</p><p className="text-xs">You or your authorized representative may present this code. The Supervisor must check the claimant in person under the store's identity procedure. Payment and physical handover must still be confirmed.</p></div>}</div>}
    {role === 'supervisor' && claimable && <button type="button" onClick={() => onOpenPickup(order)} className={buttonClass}>Confirm pickup / QR or PIN</button>}
    {order.unclaimed_reason && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{order.unclaimed_reason} Refund status: {order.refund_status?.replaceAll('_', ' ')}.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
