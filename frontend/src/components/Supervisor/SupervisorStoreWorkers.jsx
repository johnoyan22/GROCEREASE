import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, UserPlus, Users } from 'lucide-react';
import useSupervisorStaff from '../../hooks/useSupervisorStaff';
import { assignSupervisorStaff } from '../../services/api';
import StoreSelector from '../inventory/layout/StoreSelector';
import StaffAssignmentDialog from './StaffAssignmentDialog';
import StorePersonnel from './StorePersonnel';
import { Badge, StatCard } from './SupervisorUI';

function StaffIdentity({ staff }) {
  const name = [staff.first_name, staff.last_name].filter(Boolean).join(' ') || 'Inventory Worker';
  return <><p className="font-semibold">{name} <span className="text-xs font-normal text-slate-400">#{staff.id}</span></p><p className="mt-1 break-all text-xs text-slate-500">{staff.email}</p></>;
}

export function SupervisorStoreWorkers() {
  const { store, staff, availableStaff, loading, error, errorStatus, reload } = useSupervisorStaff();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [success, setSuccess] = useState('');
  const [category, setCategory] = useState('inventory');
  const matches = (person) => [person.id, person.first_name, person.last_name, person.email].join(' ').toLowerCase().includes(search.trim().toLowerCase());
  const assignedRows = staff.filter(matches);
  const availableRows = availableStaff.filter(matches);

  function refresh() {
    setSelected(null);
    setSuccess('');
    reload();
  }

  async function saveAssignment(id) {
    const result = await assignSupervisorStaff(id);
    const assignedStore = result.assignment?.store;
    if (!assignedStore?.store_id || String(result.assignment.user_id) !== String(id)) {
      throw new Error('Unexpected assignment response. Refresh before trying again.');
    }
    setSelected(null);
    setSuccess(`Inventory Worker assigned to ${assignedStore.store_name} (#${assignedStore.store_id}).`);
    reload();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row">
        <div><p className="text-xs font-semibold text-green-700">Supervisor</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Store Workers</h1><p className="mt-1 max-w-2xl text-sm text-slate-500">Manage the Inventory Workers, pickers, and packers for your assigned store.</p>{store && <p className="mt-2 text-xs text-slate-400">Store #{store.store_id}</p>}</div>
        <StoreSelector store={store} loading={loading} error={error} />
      </div>
      <div role="group" aria-label="Worker category" className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={category === 'inventory'} onClick={() => setCategory('inventory')} className={`rounded-lg border px-4 py-2.5 text-sm font-medium ${category === 'inventory' ? 'border-green-700 bg-green-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>Inventory Workers</button>
        <button type="button" aria-pressed={category === 'picking'} onClick={() => setCategory('picking')} className={`rounded-lg border px-4 py-2.5 text-sm font-medium ${category === 'picking' ? 'border-green-700 bg-green-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>Pickers &amp; Packers</button>
      </div>
      {category === 'inventory' && success && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{success}</p>}
      {loading && <p role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading your store and staff assignments...</p>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{error}</p>{errorStatus === 401 ? <Link to="/login" className="mt-2 inline-block underline">Sign in again</Link> : <button type="button" onClick={refresh} className="mt-2 font-semibold underline">Retry</button>}</div>}
      {!loading && !error && store && category === 'inventory' && <>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard icon={Users} label="Assigned Inventory Workers" value={staff.length} hint="Your current store" hintTone="gray" />
          <StatCard icon={UserPlus} label="Available Inventory Workers" value={availableStaff.length} hint="Admin-approved and unassigned" hintTone="gray" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input type="search" aria-label="Search Inventory Workers" placeholder="Search staff name, email, or account ID" value={search} onChange={(event) => setSearch(event.target.value)} className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" />
          <button type="button" onClick={() => setSearch('')} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm">Clear</button>
          <button type="button" onClick={refresh} className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm"><RefreshCw size={16} /> Refresh</button>
        </div>
        <section aria-labelledby="assigned-staff-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 id="assigned-staff-title" className="font-semibold">Inventory Workers in your store</h2>
          <p className="mt-1 text-xs text-slate-500">Showing {assignedRows.length} of {staff.length}. Staff transfers are handled by Admin.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[450px] text-left text-sm">
              <caption className="sr-only">Inventory Workers currently assigned to your store</caption>
              <thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th scope="col" className="py-3 pr-4">Staff account</th><th scope="col" className="py-3 pr-4">Role</th><th scope="col" className="py-3">Admin approval</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {assignedRows.map((person) => <tr key={person.id}><td className="py-4 pr-4"><StaffIdentity staff={person} /></td><td className="py-4 pr-4 text-slate-600">Inventory Worker</td><td className="py-4"><Badge tone={person.approved ? 'green' : 'amber'}>{person.approved ? 'Approved' : 'Approval required'}</Badge></td></tr>)}
                {assignedRows.length === 0 && <tr><td colSpan={3} className="py-10 text-center text-slate-500">{staff.length ? 'No assigned staff match your search.' : 'No Inventory Workers are assigned to your store yet.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <section aria-labelledby="available-staff-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 id="available-staff-title" className="font-semibold">Available Inventory Workers</h2>
          <p className="mt-1 text-xs text-slate-500">Showing {availableRows.length} of {availableStaff.length}. These approved login accounts have no store assignment.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-sm">
              <caption className="sr-only">Admin-approved, unassigned Inventory Workers available for assignment</caption>
              <thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th scope="col" className="py-3 pr-4">Staff account</th><th scope="col" className="py-3 pr-4">Admin approval</th><th scope="col" className="py-3 text-right">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {availableRows.map((person) => <tr key={person.id}><td className="py-4 pr-4"><StaffIdentity staff={person} /></td><td className="py-4 pr-4"><Badge tone="green">Approved</Badge></td><td className="py-4 text-right"><button type="button" disabled={!person.approved || Boolean(person.assignment)} onClick={() => { setSuccess(''); setSelected(person); }} aria-label={`Assign ${person.email} to my store`} className="rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-50">Assign to my store</button></td></tr>)}
                {availableRows.length === 0 && <tr><td colSpan={3} className="py-10 text-center text-slate-500">{availableStaff.length ? 'No available staff match your search.' : 'No approved, unassigned Inventory Workers are available. Admin can create and approve staff accounts.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <p className="text-xs text-slate-500">Inventory Worker accounts are created and approved by Admin. Supervisors assign available accounts to their own store here.</p>
      </>}
      {!loading && !error && store && category === 'picking' && (
        <StorePersonnel expectedStoreId={store.store_id} />
      )}
      {selected && store && <StaffAssignmentDialog staff={selected} store={store} onClose={() => setSelected(null)} onSave={saveAssignment} onRefresh={refresh} />}
    </div>
  );
}
