import { useEffect, useRef, useState } from 'react';
import { getStorePickupSettings, getSupervisorPickupSettings, saveSupervisorPickupSettings, suspendSupervisorPickupDate } from '../../services/api';
import { pickupServicePeriodFits, pickupServiceTimeOptions, pickupTimeLabel, suggestedPickupPeriod } from '../../services/pickup-scheduling';

const preparationChoices = [[30, '30 minutes'], [60, '1 hour'], [90, '1 hour 30 minutes'], [120, '2 hours'], [180, '3 hours']];
const windowChoices = [[60, '1 hour'], [120, '2 hours']];
const policyLabel = (choices, value) => choices.find(([minutes]) => minutes === Number(value))?.[1] ?? 'Not recorded';

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

function PickupPeriodEditor({ day, operating, period, onChange }) {
  const suggested = suggestedPickupPeriod(operating);
  const validOperating = Boolean(suggested);
  return <div className="min-w-0 space-y-2">
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!validOperating} checked={Boolean(period)} onChange={(event) => onChange(event.target.checked ? suggested : null)} />{day} pickup service</label>
    {!validOperating ? <p className="text-xs text-gray-500">Set valid store opening and closing times first.</p> : <>
      {period ? <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,140px),1fr))] gap-3">
        {[['opens_at', 'Starts'], ['closes_at', 'Ends']].map(([field, label]) => <label key={field} className="min-w-0 text-xs">{label}
          <select aria-label={day + ' pickup service ' + (field === 'opens_at' ? 'opening' : 'closing') + ' time'} required value={period[field]} onChange={(event) => onChange({ ...period, [field]: event.target.value })} className={'mt-1 w-full ' + inputClass}>
            <option value="" disabled>Select a time</option>
            {pickupServiceTimeOptions(operating, period, field).map((time) => <option key={time} value={time}>{pickupTimeLabel(time)}</option>)}
          </select>
        </label>)}
      </div> : <p className="text-xs text-gray-500">Pickup closed</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500"><span>Suggested: {pickupTimeLabel(suggested.opens_at)} – {pickupTimeLabel(suggested.closes_at)}</span><button type="button" aria-label={'Use suggested ' + day + ' pickup hours'} onClick={() => onChange(suggested)} className="font-medium text-green-800 underline">Use suggested hours</button></div>
      {operating.closes_at && suggested.opens_at === operating.opens_at && <p className="text-xs text-amber-800">This day is too short for both one-hour gaps. Choose suitable pickup hours within the store hours.</p>}
    </>}
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
      {before.pickup_preparation_minutes !== after.pickup_preparation_minutes && <li>Preparation time: {policyLabel(preparationChoices, before.pickup_preparation_minutes)} &rarr; {policyLabel(preparationChoices, after.pickup_preparation_minutes)}</li>}
      {before.pickup_window_minutes !== after.pickup_window_minutes && <li>Pickup window length: {policyLabel(windowChoices, before.pickup_window_minutes)} &rarr; {policyLabel(windowChoices, after.pickup_window_minutes)}</li>}
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
  const [preparation, setPreparation] = useState('');
  const [windowMinutes, setWindowMinutes] = useState('');
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
    setPreparation(result.pickup_preparation_minutes ?? '');
    setWindowMinutes(result.pickup_window_minutes ?? '');
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
    const suggested = suggestedPickupPeriod(period);
    const oldSuggested = suggestedPickupPeriod(hours[day]);
    setPickupHours((current) => {
      if (!period) return { ...current, [day]: null };
      if (!suggested) return current;
      const pickup = current[day];
      const followsSuggestion = pickup && oldSuggested && pickup.opens_at === oldSuggested.opens_at && pickup.closes_at === oldSuggested.closes_at;
      if ((!oldSuggested && !pickup) || followsSuggestion || (pickup && !pickupServicePeriodFits(period, pickup))) return { ...current, [day]: suggested };
      return current;
    });
  }

  async function save(event, action) {
    event.preventDefault();
    if (readOnly || busy.current) return;
    if (action === 'hours' && !window.confirm('Save pickup settings? Changes to operating or pickup-service hours may require existing-order review. Preparation time and window length apply to new checkouts.')) return;
    busy.current = true; setPending(true); setError(''); setNotice('');
    try {
      let result;
      if (action === 'hours') result = await saveSupervisorPickupSettings(hours, pickupHours, holding === '' ? null : Number(holding), Number(preparation), Number(windowMinutes));
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
      {!readOnly && <p className="text-sm text-gray-600">Suggested pickup hours start one hour after opening and end one hour before closing. Adjust them using the dropdowns within each day&apos;s store hours. Shoppers see only complete arrival windows that fit this range.</p>}
      {readOnly ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="py-2">Weekday</th><th>Store hours</th><th>Pickup service</th></tr></thead><tbody>{days.map(function (label, index) { return <tr key={label} className="border-t border-gray-100"><td className="py-3">{label}</td><td>{periodText(hours[index + 1])}</td><td>{periodText(pickupHours[index + 1])}</td></tr>; })}</tbody></table><p className="mt-4 text-sm">Preparation time: {policyLabel(preparationChoices, preparation)}</p><p className="mt-2 text-sm">Pickup window length: {policyLabel(windowChoices, windowMinutes)}</p><p className="mt-2 text-sm">Approved prepaid holding: {holding === '' ? 'Not configured' : holding + ' hours'}</p></div>
        : <form onSubmit={function (event) { save(event, 'hours'); }}><fieldset disabled={pending} className="space-y-4">
          {days.map(function (label, index) { const day = index + 1; return <div key={day} className="rounded-lg border border-gray-200 p-4"><h3 className="mb-3 font-semibold">{label}</h3><div className="grid gap-4 sm:grid-cols-2">
            <PeriodEditor label={label + ' store open'} period={hours[day]} onChange={function (period) { changeOperating(day, period); }} />
            <PickupPeriodEditor day={label} operating={hours[day]} period={pickupHours[day]} onChange={function (period) { setPickupHours(function (current) { return { ...current, [day]: period }; }); }} />
          </div></div>; })}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">Preparation time<select aria-label="Preparation time" required value={preparation} onChange={(event) => setPreparation(event.target.value)} className={'mt-1 w-full ' + inputClass}><option value="" disabled>Select preparation time</option>{preparationChoices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="block text-sm">Pickup window length<select aria-label="Pickup window length" required value={windowMinutes} onChange={(event) => setWindowMinutes(event.target.value)} className={'mt-1 w-full ' + inputClass}><option value="" disabled>Select window length</option>{windowChoices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          <p className="text-xs text-gray-600">Preparation time and pickup window length apply to new checkouts. Existing orders keep their approved schedule.</p>
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
