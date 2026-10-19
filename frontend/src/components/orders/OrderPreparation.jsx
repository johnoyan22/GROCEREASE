import { useRef, useState } from 'react';
import { assignOrderWorker, completeOrderPreparation, saveOrderPreparation } from '../../services/api';

const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-sm';
const buttonClass = 'rounded-lg border border-green-700 px-4 py-2 text-sm text-green-800 disabled:opacity-50';

export default function OrderPreparation({ order, workers, role, onSaved, onFailure }) {
  const [workerId, setWorkerId] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [quantities, setQuantities] = useState(function () {
    const values = {};
    for (const item of order.items) values[item.order_item_id] = item.prepared_qty;
    return values;
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const active = order.assignments.find(function (entry) { return entry.status === 'assigned'; });
  const completed = order.assignments.some(function (entry) { return entry.status === 'completed'; });
  const checklistComplete = order.items.every(function (item) { return item.prepared_qty === item.quantity; });

  async function perform(event, action) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try {
      let result;
      if (action === 'assign') result = await assignOrderWorker(order.order_id, Number(workerId), reason.trim() || null);
      if (action === 'checklist') {
        const items = order.items.map(function (item) { return { order_item_id: item.order_item_id, prepared_qty: Number(quantities[item.order_item_id]) }; });
        result = await saveOrderPreparation(order.order_id, items);
      }
      if (action === 'complete') result = await completeOrderPreparation(order.order_id, note.trim() || null);
      onSaved(result.message);
    } catch (failure) { setError(Object.values(failure.errors ?? {}).flat().join(' ') || failure.message); onFailure(failure); }
    finally { busy.current = false; setPending(false); }
  }

  if (!['inventory_worker', 'supervisor'].includes(role)) return null;
  return <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
    <p className="text-sm font-semibold">Preparation: {order.items.reduce(function (sum, item) { return sum + item.prepared_qty; }, 0)} / {order.items.reduce(function (sum, item) { return sum + item.quantity; }, 0)} units checked · {active ? active.worker_name+' · Busy on this order' : completed ? 'Task reviewed and completed' : 'No worker assigned'}</p>
    {role === 'supervisor' && ['waiting', 'preparing'].includes(order.status) && !completed && <form onSubmit={function (event) { perform(event, 'assign'); }} className="space-y-3"><fieldset disabled={pending} className="space-y-3"><label className="block text-sm">{active ? 'Reassign to an Available worker' : 'Assign an Available worker'}<select required value={workerId} onChange={function (event) { setWorkerId(event.target.value); }} className={inputClass}><option value="">Select a store worker</option>{workers.filter(function (worker) { return worker.status === 'active'; }).map(function (worker) { return <option key={worker.worker_id} value={worker.worker_id} disabled={worker.active_task_count > 0}>{worker.full_name} · {worker.availability}{worker.busy_order_id ? ' · Order #'+worker.busy_order_id : ''}</option>; })}</select></label>{active && <label className="block text-sm">Reassignment reason<input required value={reason} maxLength="500" onChange={function (event) { setReason(event.target.value); }} className={inputClass} /></label>}<button className={buttonClass}>{active ? 'Reassign order' : 'Assign worker'}</button></fieldset></form>}
    {order.status === 'preparing' && active && <><form onSubmit={function (event) { perform(event, 'checklist'); }} className="space-y-3"><h3 className="font-semibold">Digital preparation checklist</h3><p className="text-xs text-gray-600">Record the actual units prepared by the assigned non-login worker.</p><fieldset disabled={pending} className="space-y-3">{order.items.map(function (item) { return <label key={item.order_item_id} className="flex items-center justify-between gap-3 text-sm"><span>{item.product_name} · ordered {item.quantity}</span><input aria-label={'Prepared units for '+item.product_name} required type="number" min="0" max={item.quantity} step="1" value={quantities[item.order_item_id]} onChange={function (event) { const value = event.target.value; setQuantities(function (current) { return { ...current, [item.order_item_id]: value }; }); }} className="w-24 rounded-lg border border-gray-300 p-2" /></label>; })}<button className={buttonClass}>Save item checklist</button></fieldset></form>{role === 'supervisor' && <form onSubmit={function (event) { perform(event, 'complete'); }} className="space-y-3"><label className="block text-sm">Preparation review note<input value={note} maxLength="500" disabled={pending} onChange={function (event) { setNote(event.target.value); }} className={inputClass} /></label><button disabled={pending || !checklistComplete} className={buttonClass}>Confirm preparation complete and free worker</button></form>}</>}
    {order.assignments.length > 0 && <details className="text-xs text-gray-600"><summary className="cursor-pointer">Worker assignment history</summary><ul className="mt-2 space-y-2">{order.assignments.map(function (entry) { return <li key={entry.assignment_id}>{entry.worker_name} · {entry.status} · assigned by User #{entry.assigned_by_user_id}{entry.cancellation_reason && <p>Reassignment/cancellation: {entry.cancellation_reason}</p>}{entry.completion_note && <p>Review: {entry.completion_note}</p>}</li>; })}</ul></details>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
