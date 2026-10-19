import { useEffect, useRef, useState } from 'react';
import { getStorePickupSettings, getSupervisorPickupSettings, saveSupervisorPickupSettings, suspendSupervisorPickupDate } from '../../services/api';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const inputClass = 'rounded-lg border border-gray-300 bg-white p-2 text-sm';
const localTime = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });

function week(values) {
  const result = {};
  for (let day = 1; day <= 7; day++) result[day] = values?.[day] ?? null;
  return result;
}

function PeriodEditor({ label, period, disabled, onChange }) {
  function changeTime(field, value) {
    onChange({ ...period, [field]: value });
  }
  return <div className="space-y-2">
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={disabled} checked={Boolean(period)} onChange={function (event) { onChange(event.target.checked ? { opens_at: '', closes_at: '' } : null); }} />{label}</label>
    {period ? <div className="flex flex-wrap gap-2">
      <label className="text-xs">Opens <input aria-label={label + ' opening time'} required type="time" value={period.opens_at} onChange={function (event) { changeTime('opens_at', event.target.value); }} className={inputClass} /></label>
      <label className="text-xs">Closes <input aria-label={label + ' closing time'} required type="time" value={period.closes_at} onChange={function (event) { changeTime('closes_at', event.target.value); }} className={inputClass} /></label>
    </div> : <p className="text-xs text-gray-500">Closed</p>}
  </div>;
}

function periodText(period) {
  return period ? period.opens_at + '–' + period.closes_at : 'Closed';
}


function AuditChange({ entry }) {
  const before = entry.previous_settings ?? {};
  const after = entry.new_settings ?? {};
  return <li className="rounded-lg bg-gray-50 p-3">
    <p>Change #{entry.id} · User #{entry.changed_by_user_id} · {localTime.format(new Date(entry.created_at))}</p>
    {after.suspended_date ? <p className="mt-2">Pickup suspended on {after.suspended_date}: {after.reason}</p> : <ul className="mt-2 space-y-2">
      {days.map(function (label, index) {
        const day = index + 1;
        const previousStore = before.operating_hours?.[day];
        const nextStore = after.operating_hours?.[day];
        const previousPickup = (before.pickup_service_hours ?? before.operating_hours)?.[day];
        const nextPickup = (after.pickup_service_hours ?? after.operating_hours)?.[day];
        if (JSON.stringify(previousStore) === JSON.stringify(nextStore) && JSON.stringify(previousPickup) === JSON.stringify(nextPickup)) return null;
        return <li key={day}>{label} · Store: {periodText(previousStore)} → {periodText(nextStore)}; pickup: {periodText(previousPickup)} → {periodText(nextPickup)}</li>;
      })}
      {before.paid_order_holding_hours !== after.paid_order_holding_hours && <li>Prepaid holding: {before.paid_order_holding_hours ?? 'Not configured'} → {after.paid_order_holding_hours ?? 'Not configured'}{after.paid_order_holding_hours ? ' hours' : ''}</li>}
    </ul>}
    {after.review_order_ids?.length > 0 && <p className="mt-2">Orders flagged for review: {after.review_order_ids.map(function (id) { return '#' + id; }).join(', ')}</p>}
  </li>;
}

// Both roles read the same settings and audit records. Only the Supervisor has editing controls.
export function PickupSettingsWorkspace({ readOnly = false, storeId = null }) {
  const busy = useRef(false);
  const [settings, setSettings] = useState(null);
  const [hours, setHours] = useState(null);
  const [pickupHours, setPickupHours] = useState(null);
  const [holding, setHolding] = useState('');
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loadVersion, setLoadVersion] = useState(0);

  function showSettings(result) {
    setSettings(result);
    setHours(week(result.operating_hours));
    setPickupHours(week(result.pickup_service_hours ?? result.operating_hours));
    setHolding(result.paid_order_holding_hours ?? '');
  }

  useEffect(function () {
    const controller = new AbortController();
    let active = true;
    const request = readOnly ? getStorePickupSettings(storeId, { signal: controller.signal }) : getSupervisorPickupSettings({ signal: controller.signal });
    request.then(function (result) {
      if (active) { showSettings(result); setError(''); }
    }).catch(function (failure) {
      if (active && failure.name !== 'AbortError') { setSettings(null); setError(failure.message); }
    });
    return function () { active = false; controller.abort(); };
  }, [readOnly, storeId, loadVersion]);

  function changeOperating(day, period) {
    setHours(function (current) { return { ...current, [day]: period }; });
    if (!period) setPickupHours(function (current) { return { ...current, [day]: null }; });
  }

  async function save(event, action) {
    event.preventDefault();
    if (readOnly || busy.current) return;
    if (action === 'hours' && !window.confirm('Save these hours? Existing orders on affected weekdays will require review. Their approved windows and deadlines will stay unchanged.')) return;
    busy.current = true; setPending(true); setError(''); setNotice('');
    try {
      let result;
      if (action === 'hours') result = await saveSupervisorPickupSettings(hours, pickupHours, holding === '' ? null : Number(holding));
      else result = await suspendSupervisorPickupDate(date, reason.trim());
      if (result.store_id !== settings.store_id) {
        setSettings(null); setLoadVersion(function (value) { return value + 1; });
        throw new Error('Your store assignment changed. Review the settings for your current store.');
      }
      showSettings(result); setNotice(result.message);
      if (action === 'closure') { setDate(''); setReason(''); }
    } catch (failure) {
      setError(Object.values(failure.errors ?? {}).flat().join(' ') || failure.message);
      if ([401, 403, 404].includes(failure.status)) setSettings(null);
    } finally { busy.current = false; setPending(false); }
  }

  return <section className="space-y-5">
    <div><h2 className="text-xl font-bold">Store Operating Hours &amp; Pickup Scheduling</h2>
      <p className="mt-2 text-sm text-gray-600">Philippine time (Asia/Manila). Pickup service must operate within the store's opening hours.</p>
      {settings && <p className="mt-2 text-sm font-semibold">{settings.store.store_name} · {settings.store.address}</p>}
      {readOnly && <p className="mt-2 text-sm text-gray-600">Admin oversight: the assigned-store Supervisor manages these settings.</p>}
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="text-sm text-green-800">{notice}</p>}
    {!settings && !error && <p role="status">Loading pickup settings...</p>}
    <button type="button" disabled={pending} onClick={function () { setSettings(null); setError(''); setLoadVersion(function (value) { return value + 1; }); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">Refresh settings</button>
    {settings && <>
      {!settings.operating_hours && <p className="rounded-lg bg-amber-50 p-3 text-sm">Operating hours are not configured. Checkout cannot offer pickup windows yet.</p>}
      {settings.operating_hours && !settings.pickup_service_hours && <p className="rounded-lg bg-amber-50 p-3 text-sm">Pickup currently follows the existing store hours. The Supervisor can save separate pickup-service hours below.</p>}
      {readOnly ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="py-2">Weekday</th><th>Store hours</th><th>Pickup service</th></tr></thead><tbody>{days.map(function (label, index) { return <tr key={label} className="border-t border-gray-100"><td className="py-3">{label}</td><td>{periodText(hours[index + 1])}</td><td>{periodText(pickupHours[index + 1])}</td></tr>; })}</tbody></table><p className="mt-4 text-sm">Approved prepaid holding: {holding === '' ? 'Not configured' : holding + ' hours'}</p></div>
        : <form onSubmit={function (event) { save(event, 'hours'); }}><fieldset disabled={pending} className="space-y-4">
          {days.map(function (label, index) { const day = index + 1; return <div key={day} className="rounded-lg border border-gray-200 p-4"><h3 className="mb-3 font-semibold">{label}</h3><div className="grid gap-4 sm:grid-cols-2">
            <PeriodEditor label={label + ' store open'} period={hours[day]} onChange={function (period) { changeOperating(day, period); }} />
            <PeriodEditor label={label + ' pickup service'} period={pickupHours[day]} disabled={!hours[day]} onChange={function (period) { setPickupHours(function (current) { return { ...current, [day]: period }; }); }} />
          </div></div>; })}
          <label className="block text-sm">Approved prepaid holding period <select value={holding} onChange={function (event) { setHolding(event.target.value); }} className={inputClass}><option value="">Not configured</option><option value="24">24 hours</option><option value="48">48 hours</option></select></label>
          <p className="text-xs text-gray-600">Saved order windows and deadlines are preserved. Review affected orders using Orders → Schedule / unclaimed-order review, with a reason. Expired orders and issued strikes require reconciliation.</p>
          <button className="rounded-lg bg-green-700 px-4 py-2 text-sm text-white">Save pickup settings</button>
        </fieldset></form>}
      {!readOnly && <form onSubmit={function (event) { save(event, 'closure'); }} className="space-y-3 border-t border-gray-200 pt-5">
        <h3 className="font-semibold">Temporary pickup suspension</h3>
        <p className="text-xs text-gray-600">Suspension blocks scheduling and claiming on that date. Affected orders require review; automatic COP strikes are suppressed. Existing strikes remain under Admin correction.</p>
        <fieldset disabled={pending} className="space-y-3"><label className="block text-sm">Date <input required type="date" value={date} onChange={function (event) { setDate(event.target.value); }} className={inputClass} /></label>
          <label className="block text-sm">Required reason<input required maxLength="500" value={reason} onChange={function (event) { setReason(event.target.value); }} className={'mt-1 w-full ' + inputClass} /></label>
          <button className="rounded-lg border border-amber-500 px-4 py-2 text-sm text-amber-900">Record pickup suspension</button>
        </fieldset>
      </form>}
      <div><h3 className="font-semibold">Recorded pickup suspensions</h3><ul className="mt-2 space-y-2 text-sm">{settings.closures.map(function (closure) { return <li key={closure.id}>{closure.date} · {closure.reason} · User #{closure.recorded_by_user_id}</li>; })}</ul>{settings.closures.length === 0 && <p className="mt-2 text-sm text-gray-500">No pickup suspensions recorded.</p>}</div>
      <div><h3 className="font-semibold">Orders requiring schedule review ({settings.affected_orders.length})</h3>
        <p className="mt-1 text-xs text-gray-600">The saved schedule is unchanged. Review each affected order before pickup; ordinary rescheduling cannot extend an expired order or bypass a strike.</p>
        <ul className="mt-3 space-y-2 text-sm">{settings.affected_orders.map(function (order) { return <li key={order.order_id}>Order #{order.order_id} · {order.status.replaceAll('_', ' ')} · {localTime.format(new Date(order.pickup_window_start_at))}–{localTime.format(new Date(order.pickup_window_end_at))}</li>; })}</ul>
      </div>
      <details className="border-t border-gray-200 pt-4"><summary className="cursor-pointer font-semibold">Schedule-change audit history (latest 50)</summary>
        <ul className="mt-3 space-y-3 text-xs">{settings.schedule_history.map(function (entry) { return <AuditChange key={entry.id} entry={entry} />; })}</ul>
        {settings.schedule_history.length === 0 && <p className="mt-3 text-sm text-gray-500">No schedule changes recorded.</p>}
      </details>
    </>}
  </section>;
}

export default function StorePickupSettings({ store, onClose }) {
  const dialog = useRef(null);
  useEffect(function () {
    const element = dialog.current;
    element.showModal();
    return function () { element.close(); };
  }, []);
  return <dialog ref={dialog} onCancel={function (event) { event.preventDefault(); onClose(); }} className="fixed inset-0 m-auto max-h-[90vh] w-[min(95vw,850px)] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl backdrop:bg-black/40">
    <PickupSettingsWorkspace key={store.store_id} readOnly storeId={store.store_id} />
    <button type="button" onClick={onClose} className="mt-6 rounded-lg border border-gray-300 px-4 py-2 text-sm">Close</button>
  </dialog>;
}
