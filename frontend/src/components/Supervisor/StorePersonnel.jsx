import { useEffect, useRef, useState } from 'react';
import { createStoreWorker, getStoreWorkers, updateStoreWorker } from '../../services/api';

const types = { picker: 'Picker', packer: 'Packer', picker_packer: 'Picker / Packer' };

function PersonnelForm({ worker, onSaved }) {
  const [name, setName] = useState(worker?.full_name ?? '');
  const [workType, setWorkType] = useState(worker?.work_type ?? 'picker_packer');
  const [status, setStatus] = useState(worker?.status ?? 'active');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const saving = useRef(false);

  async function submit(event) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true; setPending(true); setError('');
    try {
      let result;
      if (worker) result = await updateStoreWorker(worker.worker_id, { full_name: name.trim(), work_type: workType, status });
      else result = await createStoreWorker({ full_name: name.trim(), work_type: workType });
      onSaved(result.message);
    } catch (failure) {
      setError(failure.message);
    } finally {
      saving.current = false; setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="font-semibold">{worker ? 'Edit ' + worker.full_name : 'Register a picker / packer'}</h3>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <fieldset disabled={pending} className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="text-sm">Full name<input required maxLength="150" value={name} onChange={function (event) { setName(event.target.value); }} className="mt-1 w-full rounded-lg border border-gray-300 p-2" /></label>
        <label className="text-sm">Work type<select value={workType} onChange={function (event) { setWorkType(event.target.value); }} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2">{Object.entries(types).map(function ([value, label]) { return <option key={value} value={value}>{label}</option>; })}</select></label>
        {worker && <label className="text-sm">Status<select value={status} onChange={function (event) { setStatus(event.target.value); }} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2"><option value="active">Active</option><option value="inactive">Inactive</option></select></label>}
        <div className="md:col-span-3"><button disabled={pending} className="rounded-lg bg-green-700 px-4 py-2 text-sm text-white disabled:opacity-50">{pending ? 'Saving...' : 'Save worker record'}</button></div>
      </fieldset>
    </form>
  );
}

export default function StorePersonnel({ expectedStoreId }) {
  const [state, setState] = useState({ workers: [], loading: true, error: '' });
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(function () {
    const controller = new AbortController(); let active = true;
    async function load() {
      try {
        const result = await getStoreWorkers({ signal: controller.signal });
        if (result.store?.store_id !== expectedStoreId || !Array.isArray(result.workers)) throw new Error('Your store assignment changed. Refresh Store Workers.');
        if (active) setState({ workers: result.workers, loading: false, error: '' });
      } catch (failure) {
        if (active && failure.name !== 'AbortError') setState({ workers: [], loading: false, error: failure.message });
      }
    }
    load(); return function () { active = false; controller.abort(); };
  }, [expectedStoreId, version]);

  function reload() { setState({ workers: [], loading: true, error: '' }); setSelected(null); setVersion(function (current) { return current + 1; }); }
  function saved(message) { setNotice(message); reload(); }
  const workers = state.workers.filter(function (worker) { return [worker.worker_id, worker.full_name, worker.work_type].join(' ').toLowerCase().includes(search.toLowerCase()); });

  return (
    <section className="space-y-5">
      <div><h2 className="text-lg font-semibold">Pickers &amp; Packers</h2><p className="mt-1 text-sm text-gray-600">Store personnel without login accounts. Worker compensation remains the supermarket’s responsibility.</p></div>
      {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      <div className="flex gap-3"><input aria-label="Search picking and packing workers" type="search" value={search} onChange={function (event) { setSearch(event.target.value); }} placeholder="Search workers..." className="flex-1 rounded-lg border border-gray-300 bg-white p-2 text-sm" /><button type="button" onClick={reload} className="rounded-lg border border-green-700 px-4 py-2 text-sm text-green-800">Refresh</button></div>
      {state.loading && <p role="status">Loading store workers...</p>}
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {!state.loading && !state.error && <>
        <PersonnelForm key={selected?.worker_id ?? 'new'} worker={selected} onSaved={saved} />
        {selected && <button type="button" onClick={function () { setSelected(null); }} className="text-sm font-semibold text-green-800">Register another worker</button>}
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white"><table className="w-full min-w-[540px] text-left text-sm"><thead className="bg-gray-50"><tr>{['Worker', 'Work type', 'Status', 'Active tasks', 'Action'].map(function (label) { return <th key={label} scope="col" className="p-3">{label}</th>; })}</tr></thead><tbody>{workers.map(function (worker) { return <tr key={worker.worker_id} className="border-t border-gray-100"><td className="p-3">{worker.full_name} <span className="text-xs text-gray-500">#{worker.worker_id}</span></td><td className="p-3">{types[worker.work_type]}</td><td className="p-3">{worker.status}</td><td className="p-3">{worker.active_task_count}</td><td className="p-3"><button type="button" onClick={function () { setSelected(worker); }} className="font-semibold text-green-800">Edit</button></td></tr>; })}</tbody></table>{workers.length === 0 && <p className="p-5 text-sm text-gray-600">No matching store personnel.</p>}</div>
        <p className="text-sm text-gray-500">Incentive calculations and payouts await the approved supermarket policy. No automatic payout is recorded here.</p>
      </>}
    </section>
  );
}
