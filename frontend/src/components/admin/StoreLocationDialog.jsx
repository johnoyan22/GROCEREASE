import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { getAdminStoreLocation, saveAdminStoreLocation } from '../../services/api';

export default function StoreLocationDialog({ store, onClose }) {
  const dialog = useRef(null);
  const [form, setForm] = useState({ latitude: '', longitude: '', verified: false, verification_note: '' });
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState(''), [success, setSuccess] = useState(''), [addressChanged, setAddressChanged] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    const element = dialog.current, controller = new AbortController();
    element.showModal();
    getAdminStoreLocation(store.store_id, { signal: controller.signal }).then(({ location }) => {
      setAvailable(true);
      if (location) { setForm(current => ({ ...current, latitude: location.latitude, longitude: location.longitude, verified: location.verified })); setAddressChanged(location.address_changed); }
    }).catch(failure => { if (failure.name !== 'AbortError') setError(failure.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); element.close(); };
  }, [store.store_id]);
  async function save(event) {
    event.preventDefault(); if (pending.current) return;
    pending.current = true; setSaving(true); setError(''); setSuccess('');
    try {
      const result = await saveAdminStoreLocation(store.store_id, { ...form, latitude: Number(form.latitude), longitude: Number(form.longitude), expected_address: store.address });
      setSuccess(result.message); setAddressChanged(false); setForm(current => ({ ...current, verification_note: '' }));
    } catch (failure) { setError(failure.message); }
    finally { pending.current = false; setSaving(false); }
  }
  return <dialog ref={dialog} aria-labelledby="store-location-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }} className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-0 text-slate-800 shadow-xl backdrop:bg-black/40">
    <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5"><div><h2 id="store-location-title" className="text-lg font-bold">Store map location</h2><p className="mt-1 text-sm text-slate-600">{store.store_name}</p></div><button type="button" aria-label="Close store location" onClick={onClose} disabled={saving} className="rounded-lg p-2"><X size={19} /></button></div>
    <form onSubmit={save} className="space-y-4 p-5">
      <p className="rounded-lg bg-slate-50 p-3 text-sm">Registered address: {store.address}</p>
      <p className="text-sm text-slate-600">Enter coordinates checked against the supermarket’s actual pickup location. Leave unverified for demonstration or uncertain records. Only active, verified stores appear publicly.</p>
      {loading && <p role="status">Loading map location…</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {success && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-900">{success}</p>}
      {addressChanged && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">The store address changed. Check this pin again before publishing it.</p>}
      <div className="grid gap-4 sm:grid-cols-2">{[['latitude','Latitude',-90,90],['longitude','Longitude',-180,180]].map(([name,label,min,max]) => <label key={name} className="block text-sm font-medium">{label}<input name={name} type="number" step="0.0000001" min={min} max={max} required disabled={loading || saving} value={form[name]} onChange={event => { setForm(current => ({ ...current, [name]: event.target.value, verified: false })); setSuccess(''); }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>)}</div>
      <label className="flex items-start gap-3 rounded-lg border border-green-100 p-3 text-sm"><input type="checkbox" checked={form.verified} disabled={loading || saving} onChange={event => setForm(current => ({ ...current, verified: event.target.checked }))} className="mt-1" /><span>I verified this pin matches the actual pickup address and approve displaying this registered store on the public locator.</span></label>
      <label className="block text-sm font-medium">Verification note<textarea required minLength={3} maxLength={500} rows={3} value={form.verification_note} disabled={loading || saving} onChange={event => setForm(current => ({ ...current, verification_note: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /><span className="mt-1 block text-xs font-normal text-slate-600">Record the approved address source or why the pin remains unpublished.</span></label>
      <div className="flex justify-end gap-3"><button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-lg border border-slate-300 px-4">Close</button><button type="submit" disabled={loading || saving || !available} className="ge-button px-4">{saving ? 'Saving…' : 'Save map location'}</button></div>
    </form>
  </dialog>;
}
