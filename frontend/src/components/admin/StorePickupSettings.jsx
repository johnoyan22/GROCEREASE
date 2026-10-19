import { useEffect, useRef, useState } from 'react';
import { closeStorePickupDate, getStorePickupSettings, saveStorePickupSettings } from '../../services/api';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const inputClass = 'rounded-lg border border-gray-300 bg-white p-2 text-sm';

export default function StorePickupSettings({ store, onClose }) {
  const dialog = useRef(null);
  const busy = useRef(false);
  const [hours, setHours] = useState(null);
  const [holding, setHolding] = useState('');
  const [closures, setClosures] = useState([]);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(function () {
    const element = dialog.current;
    element.showModal();
    const controller = new AbortController();
    getStorePickupSettings(store.store_id, { signal: controller.signal }).then(function (result) {
      const values = {};
      for (let day = 1; day <= 7; day++) values[day] = result.operating_hours?.[day] ?? null;
      setHours(values); setHolding(result.paid_order_holding_hours ?? ''); setClosures(result.closures);
    }).catch(function (failure) { if (failure.name !== 'AbortError') setError(failure.message); });
    return function () { controller.abort(); element.close(); };
  }, [store.store_id]);

  function changePeriod(day, field, value) {
    setHours(function (current) { return { ...current, [day]: { ...current[day], [field]: value } }; });
  }

  async function save(event, action) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true; setPending(true); setError(''); setNotice('');
    try {
      let result;
      if (action === 'hours') result = await saveStorePickupSettings(store.store_id, hours, holding === '' ? null : Number(holding));
      else {
        result = await closeStorePickupDate(store.store_id, date, reason.trim());
        const refreshed = await getStorePickupSettings(store.store_id);
        setClosures(refreshed.closures); setReason('');
      }
      setNotice(result.message);
    } catch (failure) { setError(Object.values(failure.errors ?? {}).flat().join(' ') || failure.message); }
    finally { busy.current = false; setPending(false); }
  }

  return <dialog ref={dialog} onCancel={function (event) { event.preventDefault(); if (!pending) onClose(); }} className="fixed inset-0 m-auto max-h-[90vh] w-[min(95vw,720px)] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl backdrop:bg-black/40">
    <h2 className="text-xl font-bold">Pickup settings · {store.store_name}</h2><p className="mt-2 text-sm text-gray-600">All hours use Philippine time (Asia/Manila). Configure actual store hours. Existing approved order schedules retain their saved deadlines; review affected orders when changing hours.</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="mt-3 text-sm text-green-800">{notice}</p>}
    {!hours && !error && <p className="mt-4">Loading settings...</p>}
    {hours && <><form onSubmit={function (event) { save(event, 'hours'); }} className="mt-5 space-y-4"><fieldset disabled={pending} className="space-y-3">{days.map(function (label, index) { const day = index + 1; const period = hours[day]; return <div key={day} className="flex flex-wrap items-center gap-3"><label className="w-32 text-sm"><input type="checkbox" checked={Boolean(period)} onChange={function (event) { const open = event.target.checked; setHours(function (current) { return { ...current, [day]: open ? { opens_at: '', closes_at: '' } : null }; }); }} /> {label}</label>{period ? <><label className="text-xs">Opens <input aria-label={`${label} opening time`} required type="time" value={period.opens_at} onChange={function (event) { changePeriod(day, 'opens_at', event.target.value); }} className={inputClass} /></label><label className="text-xs">Closes <input aria-label={`${label} closing time`} required type="time" value={period.closes_at} onChange={function (event) { changePeriod(day, 'closes_at', event.target.value); }} className={inputClass} /></label></> : <span className="text-sm text-gray-500">Closed</span>}</div>; })}<label className="block text-sm">Approved paid-order holding policy <select value={holding} onChange={function (event) { setHolding(event.target.value); }} className={inputClass}><option value="">Not configured</option><option value="24">24 hours</option><option value="48">48 hours</option></select></label><button className="rounded-lg bg-green-700 px-4 py-2 text-sm text-white">Save pickup settings</button></fieldset></form>
      <form onSubmit={function (event) { save(event, 'closure'); }} className="mt-6 space-y-3 border-t border-gray-200 pt-5"><h3 className="font-semibold">Record a closed or suspended pickup date</h3><p className="text-xs text-gray-600">This blocks pickup for the date and suppresses automatic COP strikes. Erroneous strikes already issued require an Admin correction.</p><fieldset disabled={pending} className="space-y-3"><label className="block text-sm">Date <input required type="date" value={date} onChange={function (event) { setDate(event.target.value); }} className={inputClass} /></label><label className="block text-sm">Reason<input required maxLength="500" value={reason} onChange={function (event) { setReason(event.target.value); }} className={`mt-1 w-full ${inputClass}`} /></label><button className="rounded-lg border border-amber-500 px-4 py-2 text-sm text-amber-900">Record pickup suspension</button></fieldset></form>
      <ul className="mt-4 space-y-2 text-xs text-gray-600">{closures.map(function (closure) { return <li key={closure.id}>{closure.date} · {closure.reason}</li>; })}</ul></>}
    <button type="button" disabled={pending} onClick={onClose} className="mt-6 rounded-lg border border-gray-300 px-4 py-2 text-sm">Close</button>
  </dialog>;
}
