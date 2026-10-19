import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { confirmOrderCash, getOrderPickup, recordOrderHandover, verifyOrderPickup } from '../../services/api';

const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-sm';
const buttonClass = 'rounded-lg bg-green-700 px-4 py-2 text-sm text-white disabled:opacity-50';
const localTime = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });

export default function OrderPickup({ order, role, onSaved, onFailure }) {
  const [credential, setCredential] = useState(null);
  const [qrImage, setQrImage] = useState('');
  const [method, setMethod] = useState('pin');
  const [code, setCode] = useState('');
  const [claimant, setClaimant] = useState('');
  const [claimantNote, setClaimantNote] = useState('');
  const [cashier, setCashier] = useState('');
  const [cashReference, setCashReference] = useState('');
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
    if (action === 'handover' && !window.confirm('Payment and claimant have been verified. Confirm that you physically handed the groceries to the verified claimant. This completes the order.')) return;
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
      if (action === 'cash') result = await confirmOrderCash(order.order_id, { cashier_name: cashier.trim(), evidence_reference: cashReference.trim(), cash_collected: true });
      if (action === 'verify') result = await verifyOrderPickup(order.order_id, { method, credential: code.trim(), claimant_name: claimant.trim(), identity_checked: true, claimant_check_note: claimantNote.trim() || null });
      if (action === 'handover') result = await recordOrderHandover(order.order_id);
      onSaved(result.message);
    } catch (failure) { setError(Object.values(failure.errors ?? {}).flat().join(' ') || failure.message); onFailure(failure); }
    finally { setCode(''); busy.current = false; setPending(false); }
  }

  if (!pickup || !['shopper', 'supervisor'].includes(role)) return null;
  const claimable = order.status === 'ready_for_pickup' && order.claim_status === 'claimable';
  return <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
    <p className="text-sm">Claim state: <strong>{order.claim_status?.replaceAll('_', ' ')}</strong> · Claimant: <strong>{pickup.verified_at ? pickup.claimant_name : 'Not yet checked'}</strong> · Handover: <strong>{pickup.handed_over_at ? 'Recorded' : 'Pending'}</strong></p>
    {order.claim_expires_at && <p className="text-xs text-gray-600">Claim deadline: {localTime.format(new Date(order.claim_expires_at))} (Philippine time). Store pickup hours also apply.</p>}
    {role === 'shopper' && claimable && <div className="space-y-3"><button type="button" disabled={pending} onClick={function () { perform('show'); }} className={buttonClass}>Show QR / pickup PIN</button>{credential && <div className="rounded-lg bg-green-50 p-4"><p className="text-sm">Order #{order.order_id} · One-time pickup credential</p>{qrImage && <img src={qrImage} alt={'Pickup QR code for order '+order.order_id} width="240" height="240" className="mt-3" />}<p className="my-3 font-mono text-3xl tracking-widest">{credential.pin}</p><p className="text-xs">You or your authorized representative may present this code. The Supervisor must check the claimant in person under the store's identity procedure. Payment and physical handover must still be confirmed.</p></div>}</div>}
    {role === 'supervisor' && claimable && <>
      {!pickup.verified_at && <form onSubmit={function (event) { perform('verify', event); }} className="space-y-3 rounded-lg border border-gray-200 p-4"><h3 className="font-semibold">Verify pickup credential and claimant</h3><fieldset disabled={pending} className="space-y-3"><label className="block text-sm">Credential method<select value={method} onChange={function (event) { setMethod(event.target.value); setCode(''); }} className={inputClass}><option value="pin">Pickup PIN</option><option value="qr">Scanned QR token</option></select></label><label className="block text-sm">{method === 'pin' ? '8-digit pickup PIN' : 'Scan the QR into this field with the store scanner'}<input required type="password" inputMode={method === 'pin' ? 'numeric' : 'text'} pattern={method === 'pin' ? '[0-9]{8}' : '[a-f0-9]{64}'} autoComplete="off" maxLength={method === 'pin' ? 8 : 64} value={code} onChange={function (event) { setCode(event.target.value); }} className={inputClass} /></label><label className="block text-sm">Actual claimant's full name<input required maxLength="150" value={claimant} onChange={function (event) { setClaimant(event.target.value); }} className={inputClass} /></label><label className="block text-sm">Claimant check note (optional; follow the store's identity procedure)<input maxLength="250" value={claimantNote} onChange={function (event) { setClaimantNote(event.target.value); }} className={inputClass} /></label><label className="flex gap-2 text-sm"><input required type="checkbox" />I checked this claimant in person under the supermarket's identity procedure. The code alone was not treated as proof of identity.</label><button className={buttonClass}>Confirm claimant verification</button></fieldset></form>}
      {order.payment_method === 'cash_on_pickup' && order.payment_status === 'unpaid' && <form onSubmit={function (event) { perform('cash', event); }} className="space-y-3 rounded-lg border border-gray-200 p-4"><h3 className="font-semibold">Confirm cashier's cash collection</h3><fieldset disabled={pending} className="space-y-3"><label className="block text-sm">Cashier name<input required maxLength="150" value={cashier} onChange={function (event) { setCashier(event.target.value); }} className={inputClass} /></label><label className="block text-sm">Receipt / cashier confirmation reference<input required maxLength="250" value={cashReference} onChange={function (event) { setCashReference(event.target.value); }} className={inputClass} /></label><label className="flex gap-2 text-sm"><input required type="checkbox" />The cashier collected the full order total. I checked the evidence.</label><button className={buttonClass}>Confirm cash payment</button></fieldset></form>}
      {pickup.verified_at && order.payment_status === 'paid' && <button type="button" disabled={pending} onClick={function () { perform('handover'); }} className={buttonClass}>Record physical handover and complete</button>}
    </>}
    {order.unclaimed_reason && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{order.unclaimed_reason} Refund status: {order.refund_status?.replaceAll('_', ' ')}.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
