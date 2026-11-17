import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { claimOrderPickup, confirmOrderCash, getStoreWorkers, lookupOrderReference, resolvePickup } from '../../services/api';
import { createPickupCamera, isPickupQr } from '../../services/pickup-camera';

const input = 'mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-sm';
const button = 'rounded-lg bg-green-700 px-4 py-2 text-sm text-white disabled:opacity-50';
const time = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });
const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

export default function PickupClaimModal(props) {
  return <PickupClaimDialog key={props.storeId + ':' + (props.orderContext?.order_id ?? 'scan')} {...props} />;
}

function PickupClaimDialog({ storeId, orderContext = null, onClose, onClaimed, onDocument }) {
  const dialog = useRef(null), video = useRef(null), camera = useRef(null), heading = useRef(null);
  const alive = useRef(false), busy = useRef(false), revision = useRef(0), secret = useRef(null);
  const previewRequest = useRef(null);
  const assignmentClose = useRef(onClose);
  useEffect(function () { assignmentClose.current = onClose; }, [onClose]);
  const [mode, setMode] = useState('qr');
  const [reference, setReference] = useState(orderContext?.order_reference ?? '');
  const [pin, setPin] = useState('');
  const [preview, setPreview] = useState(null);
  const [expires, setExpires] = useState(null);
  const [claimingAs, setClaimingAs] = useState('shopper');
  const [claimant, setClaimant] = useState(''), [note, setNote] = useState('');
  const [identity, setIdentity] = useState(false), [handedOver, setHandedOver] = useState(false);
  const [cashier, setCashier] = useState(''), [evidence, setEvidence] = useState(''), [cashCollected, setCashCollected] = useState(false);
  const [pending, setPending] = useState(false), [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState(''), [cameraState, setCameraState] = useState('stopped');
  const [devices, setDevices] = useState([]), [device, setDevice] = useState('');

  function clear() {
    previewRequest.current?.abort();
    revision.current++; secret.current = null;
    setPin(''); setPreview(null); setExpires(null); setIdentity(false); setHandedOver(false);
    setClaimingAs('shopper'); setClaimant(''); setNote('');
    setCashier(''); setEvidence(''); setCashCollected(false);
  }
  function stopCamera() { camera.current?.stop(); setCameraState('stopped'); }
  function close() { stopCamera(); previewRequest.current?.abort(); revision.current++; secret.current = null; onClose(); }

  useEffect(function () {
    alive.current = true;
    const element = dialog.current;
    const versionRef = revision;
    const requestRef = previewRequest;
    element.showModal();
    const stop = () => { camera.current?.stop(); };
    const hidden = () => {
      if (document.hidden) {
        stop(); setCameraState('stopped');
        // A submitted request may still complete. Keep its recovery state.
        if (!busy.current) { clear(); setError('Pickup paused. Scan again or enter the PIN to continue.'); }
      }
    };
    const controller = new AbortController();
    const checkAssignment = async () => {
      try {
        const result = await getStoreWorkers({ signal: controller.signal });
        if (alive.current && Number(result.store?.store_id) !== Number(storeId)) {
          stop(); clear(); setCameraState('stopped'); setError('Your store assignment changed. Close pickup and refresh Orders.');
          assignmentClose.current();
        }
      } catch (failure) {
        if (alive.current && [401, 403].includes(failure.status)) {
          stop(); clear(); setCameraState('stopped'); setError('Your staff session changed. Close pickup and sign in again.');
          assignmentClose.current();
        }
      }
    };
    window.addEventListener('pagehide', stop);
    window.addEventListener('focus', checkAssignment);
    document.addEventListener('visibilitychange', hidden);
    return function () {
      alive.current = false; versionRef.current++; secret.current = null; controller.abort(); requestRef.current?.abort();
      stop(); element.close();
      window.removeEventListener('pagehide', stop);
      window.removeEventListener('focus', checkAssignment);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [storeId, orderContext?.order_id]);

  useEffect(function () { if (preview) heading.current?.focus(); }, [preview]);

  useEffect(function () {
    if (!expires || !preview || uncertain) return;
    const timer = setTimeout(function () {
      if (busy.current) return; // Submission revalidates server-side; preserve uncertain-result recovery.
      clear(); setError('This preview expired. Scan again or use a current PIN.');
    }, Math.max(0, new Date(expires).getTime() - Date.now()));
    return () => clearTimeout(timer);
  }, [expires, preview, uncertain]);

  async function resolve(method, code) {
    if (busy.current) return;
    stopCamera(); clear(); setError('');
    if (method === 'qr' && !isPickupQr(code)) { setError('This is not a GrocerEase pickup QR. Rescan or use the pickup PIN.'); return; }
    busy.current = true; setPending(true);
    const version = revision.current;
    const controller = new AbortController(); previewRequest.current = controller;
    try {
      const result = await resolvePickup({ method, credential: code, ...(method === 'pin' ? { reference: reference.trim() } : {}), ...(orderContext ? { order_context: orderContext.order_id } : {}) }, { signal: controller.signal });
      if (!alive.current || version !== revision.current) return;
      if (Number(result.order.store_id) !== Number(storeId)) throw new Error('Your store assignment changed. Close pickup and refresh Orders.');
      secret.current = { method, credential: code };
      setPreview(result.order); setExpires(result.credential_expires_at);
      setReference(result.order.order_reference);
    } catch (failure) {
      if (alive.current && version === revision.current) setError(failure.message);
    } finally { if (alive.current && version === revision.current) setPending(false); busy.current = false; }
  }

  function startCamera(selected = device) {
    clear(); setError(''); setUncertain(false);
    camera.current?.stop();
    camera.current = createPickupCamera({ video: video.current,
      onCandidate: code => { if (alive.current) resolve('qr', code); },
      onError: message => { if (alive.current) { setError(message); setCameraState('stopped'); } },
      onState: (state, available) => { if (alive.current) { setCameraState(state); if (available) setDevices(available); } },
    });
    camera.current.start(selected);
  }

  async function recover() {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try {
      const result = await lookupOrderReference(reference);
      if (!alive.current) return;
      if (Number(result.order.store_id) !== Number(storeId)) throw new Error('Your store assignment changed. Close pickup and refresh Orders.');
      if (result.order.status === 'completed') { secret.current = null; onClaimed(result.order, 'Already claimed. The saved Pickup Receipt is available.'); return; }
      // Refresh is read-only. Require a fresh credential preview and unchecked controls.
      clear(); setUncertain(false); setError('The order is still pending handover. Payment shown on the next preview reflects any saved cash confirmation. Scan again or use the PIN.');
    } catch (failure) { if (alive.current) setError('Unable to check the saved result. '+failure.message); }
    finally { busy.current = false; if (alive.current) setPending(false); }
  }

  async function cash(event) {
    event.preventDefault();
    if (busy.current || !preview || !cashCollected) return;
    busy.current = true; setPending(true); setError('');
    try {
      const result = await confirmOrderCash(preview.order_id, { cashier_name: cashier.trim(), evidence_reference: evidence.trim(), cash_collected: cashCollected });
      if (alive.current) { setPreview(result.order); setCashier(''); setEvidence(''); setCashCollected(false); setError('Cash payment saved. Confirm the claimant and physical handover to finish.'); }
    } catch (failure) { if (alive.current) { setUncertain(true); secret.current = null; setIdentity(false); setHandedOver(false); setError('Cash confirmation was not confirmed in this browser. Check the saved result before retrying. '+failure.message); } }
    finally { busy.current = false; if (alive.current) setPending(false); }
  }

  async function claim(event) {
    event.preventDefault();
    if (busy.current || !preview || !secret.current || !identity || !handedOver || !preview.pickup?.payment_valid || uncertain) return;
    busy.current = true; setPending(true); setError('');
    try {
      const result = await claimOrderPickup(preview.order_id, { ...secret.current, claiming_as: claimingAs,
        ...(claimingAs === 'representative' ? { claimant_name: claimant.trim() } : {}), claimant_check_note: note.trim() || null,
        identity_checked: identity, physically_handed_over: handedOver });
      if (alive.current) { secret.current = null; onClaimed(result.order, result.message); }
    } catch (failure) {
      if (alive.current) { secret.current = null; setIdentity(false); setHandedOver(false); setUncertain(true); setError('Claim result needs checking. Refresh the saved order before another attempt. '+failure.message); }
    } finally { busy.current = false; if (alive.current) setPending(false); }
  }

  const legacy = preview?.pickup?.verified_at;
  const paid = preview?.pickup?.payment_valid === true;
  const canClaim = paid && identity && handedOver && (legacy || claimingAs === 'shopper' || claimant.trim()) && !pending && !uncertain;
  return createPortal(<dialog ref={dialog} aria-labelledby="pickup-claim-title" onCancel={event => { event.preventDefault(); close(); }} className="fixed inset-0 m-auto max-h-[92dvh] w-[min(95vw,560px)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 shadow-xl backdrop:bg-black/40">
    <h2 id="pickup-claim-title" ref={heading} tabIndex="-1" className="text-xl font-bold">Pickup confirmation</h2>
    {error && <p role="alert" className="my-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{error}</p>}
    {uncertain ? <button type="button" disabled={pending} className={button+' mt-4'} onClick={recover}>Check saved order result</button> : <>
      {!preview && <div className="mt-4 space-y-3">
        {mode === 'qr' ? <>
          <p className="text-sm">Scan the Shopper's pickup QR. Check the claimant in person before release.</p>
          <video ref={video} playsInline muted aria-label="Pickup camera preview" className={'aspect-video w-full rounded-lg bg-gray-950 object-contain '+(cameraState === 'stopped' ? 'hidden' : '')} />
          <div className="flex flex-wrap gap-2"><button type="button" disabled={pending || cameraState === 'starting' || cameraState === 'running'} onClick={() => startCamera()} className={button}>{error ? 'Rescan / Open Camera' : 'Open Camera'}</button>{cameraState !== 'stopped' && <button type="button" className="rounded-lg border p-2 text-sm" onClick={stopCamera}>Stop Camera</button>}<button type="button" disabled={pending} onClick={() => { stopCamera(); clear(); setError(''); setMode('pin'); }} className="rounded-lg border p-2 text-sm">Use PIN instead</button></div>
          {cameraState === 'starting' && <p role="status" className="text-sm">Starting camera. Allow video access in your browser.</p>}
          {devices.length > 1 && <label className="block text-sm">Camera<select aria-label="Camera" value={device} onChange={event => { setDevice(event.target.value); startCamera(event.target.value); }} disabled={pending} className={input}><option value="">Preferred rear camera</option>{devices.map((item, i) => <option key={item.deviceId} value={item.deviceId}>{item.label || 'Camera '+(i+1)}</option>)}</select></label>}
        </> : <form onSubmit={event => { event.preventDefault(); resolve('pin', pin); }} className="space-y-3">
          <label className="block text-sm">Exact GrocerEase order reference<input required autoComplete="off" value={reference} readOnly={Boolean(orderContext)} onChange={event => { setReference(event.target.value); setPin(''); }} placeholder="GE-ORD-00000123" className={input} /></label>
          <label className="block text-sm">8-digit pickup PIN<input required type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{8}" maxLength="8" value={pin} onChange={event => setPin(event.target.value)} className={input} /></label>
          <div className="flex flex-wrap gap-2"><button disabled={pending} className={button}>Validate PIN</button><button type="button" disabled={pending} onClick={() => { clear(); setMode('qr'); setError(''); }} className="rounded-lg border p-2 text-sm">Use QR instead</button></div>
        </form>}
        {pending && <p role="status" className="text-sm">Validating pickup...</p>}
      </div>}
      {preview && <div className="mt-4 space-y-4 text-sm">
        <div className="rounded-lg bg-green-50 p-3"><p className="font-bold">{preview.order_reference}</p><p>{preview.store_name} · {preview.shopper_name}</p><p>{time.format(new Date(preview.pickup_window_start_at))} to {time.format(new Date(preview.pickup_window_end_at))} (Philippine time)</p><p className="mt-2 font-semibold">{money.format(preview.total_centavos / 100)} · {paid ? 'Payment confirmed' : preview.payment_status}</p><details className="mt-2"><summary className="cursor-pointer">{preview.items.reduce((sum, item) => sum + item.quantity, 0)} items · Show details</summary><ul>{preview.items.map((item, index) => <li key={index}>{item.quantity} × {item.product_name} {item.size}</li>)}</ul></details></div>
        {preview.payment_method === 'cash_on_pickup' && preview.payment_status === 'unpaid' && <form onSubmit={cash} className="space-y-3 rounded-lg border p-3"><h3 className="font-semibold">Cash collection</h3><fieldset disabled={pending} className="space-y-3"><label className="block">Cashier name<input required maxLength="150" value={cashier} onChange={event => setCashier(event.target.value)} className={input} /></label><label className="block">Receipt / cashier confirmation reference<input required maxLength="250" value={evidence} onChange={event => setEvidence(event.target.value)} className={input} /></label><label className="flex items-start gap-2"><input required type="checkbox" checked={cashCollected} onChange={event => setCashCollected(event.target.checked)} />The cashier collected the full total. I checked the evidence.</label><button className={button}>Save cash payment</button></fieldset></form>}
        {!paid && preview.payment_method !== 'cash_on_pickup' && <p role="status">Trusted digital payment confirmation is required. Cash cannot override this payment method.</p>}
        <form onSubmit={claim} className="space-y-3"><fieldset disabled={pending} className="space-y-3">
          {legacy ? <p className="rounded-lg bg-gray-50 p-3">Existing claimant verification: <strong>{preview.pickup.claimant_name}</strong>. The original claimant and audit will be preserved. Recheck this person before handover.</p> : <><label className="block">Claiming as<select className={input} value={claimingAs} onChange={event => { setClaimingAs(event.target.value); setClaimant(''); setIdentity(false); setHandedOver(false); }}><option value="shopper">Shopper — {preview.shopper_name}</option><option value="representative">Authorized representative</option></select></label>{claimingAs === 'representative' && <label className="block">Actual claimant's full name<input required maxLength="150" value={claimant} onChange={event => { setClaimant(event.target.value); setIdentity(false); }} className={input} /></label>}<label className="block">Claimant check note (optional)<input maxLength="250" value={note} onChange={event => setNote(event.target.value)} className={input} /></label></>}
          <label className="flex items-start gap-2"><input required type="checkbox" checked={identity} onChange={event => setIdentity(event.target.checked)} />I checked the actual claimant in person under the store's identity procedure.</label>
          <label className="flex items-start gap-2"><input required type="checkbox" checked={handedOver} onChange={event => setHandedOver(event.target.checked)} />I physically handed the goods to this verified claimant.</label>
          <button disabled={!canClaim} className={button}>Confirm &amp; Mark Claimed</button>
        </fieldset></form>
        <div className="flex flex-wrap gap-3"><button type="button" disabled={pending} onClick={() => { stopCamera(); clear(); setError(''); }} className="text-green-800 underline">Scan / enter another credential</button><button type="button" disabled={pending} onClick={() => { secret.current = null; onDocument(preview.order_id); }} className="text-green-800 underline">Print Order Summary</button></div>
      </div>}
    </>}
    <button type="button" onClick={close} className="mt-5 rounded-lg border border-gray-300 px-4 py-2 text-sm">{pending ? 'Close (check saved result in Orders)' : 'Cancel / Close'}</button>
  </dialog>, document.body);
}
