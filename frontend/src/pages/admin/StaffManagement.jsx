import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import StaffActionDialog from '../../components/admin/StaffActionDialog';
import useAdminStaff from '../../hooks/useAdminStaff';
import { approveAdminStaff, assignAdminStaffStore, createAdminStaff } from '../../services/api';

const roleLabels = { inventory_worker: 'Inventory Worker', supervisor: 'Supervisor' };

export default function StaffManagement() {
  const { staff, stores, loading, error, errorStatus, reload } = useAdminStaff();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [approval, setApproval] = useState('');
  const [action, setAction] = useState(null);
  const [success, setSuccess] = useState('');

  const filtered = staff.filter((person) => {
    const text = [person.id, person.first_name, person.last_name, person.email, person.assignment?.store?.store_name].join(' ').toLowerCase();
    return text.includes(search.trim().toLowerCase()) && (!role || person.role === role)
      && (!approval || (approval === 'approved' ? person.approved : !person.approved));
  });
  const summary = [
    ['Staff accounts', staff.length],
    ['Supervisors', staff.filter((person) => person.role === 'supervisor').length],
    ['Inventory Workers', staff.filter((person) => person.role === 'inventory_worker').length],
    ['Pending approval', staff.filter((person) => !person.approved).length],
  ];

  function openAction(mode, person) {
    setSuccess('');
    setAction({ mode, staff: person });
  }

  async function saveStaff(details) {
    const result = action.mode === 'create'
      ? await createAdminStaff(details)
      : action.mode === 'approve'
        ? await approveAdminStaff(action.staff.id)
        : await assignAdminStaffStore(action.staff.id, details.store_id);
    setSuccess(result.message || 'Staff changes saved.');
    setAction(null);
    reload();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Staff Management</h1>
          <p className="mt-1 text-sm text-slate-500">Create and approve staff login accounts, then assign Supervisors and Inventory Workers to their stores.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={loading || Boolean(action)} onClick={() => { setSuccess(''); reload(); }} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium disabled:opacity-50"><RefreshCw size={16} /> Refresh</button>
          <button type="button" disabled={loading || Boolean(error) || Boolean(action)} onClick={() => openAction('create')} className="flex items-center gap-2 rounded-xl bg-[#0E5C2F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"><Plus size={16} /> Create Staff Account</button>
        </div>
      </div>
      {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}
      {loading && <p role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading staff and store assignments...</p>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{error}</p>{errorStatus === 401 ? <Link to="/login" className="mt-2 inline-block underline">Sign in again</Link> : <button type="button" onClick={reload} className="mt-2 font-semibold underline">Retry</button>}</div>}
      {!loading && !error && <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summary.map(([label, count]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-800">{count}</p></div>)}
        </div>
        {stores.length === 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">There are no active stores available for assignment. Accounts can still be created and approved.</p>}
        <section aria-label="Staff accounts" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-100 p-5 lg:grid-cols-[minmax(200px,1fr)_180px_180px_auto]">
            <input type="search" aria-label="Search staff" placeholder="Search name, email, ID, or store" value={search} onChange={(event) => setSearch(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
            <select aria-label="Filter staff role" value={role} onChange={(event) => setRole(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">All staff roles</option><option value="supervisor">Supervisor</option><option value="inventory_worker">Inventory Worker</option></select>
            <select aria-label="Filter approval" value={approval} onChange={(event) => setApproval(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">All approvals</option><option value="approved">Approved</option><option value="pending">Pending approval</option></select>
            <button type="button" onClick={() => { setSearch(''); setRole(''); setApproval(''); }} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm">Clear</button>
          </div>
          <p className="px-5 pt-4 text-xs text-slate-500">Showing {filtered.length} of {staff.length} staff accounts</p>
          <div className="overflow-x-auto p-5 pt-2">
            <table className="w-full min-w-[850px] text-left text-sm">
              <caption className="sr-only">Staff accounts, Admin approval, and current store assignments</caption>
              <thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th scope="col" className="py-3 pr-4">Staff account</th><th scope="col" className="py-3 pr-4">Role</th><th scope="col" className="py-3 pr-4">Admin approval</th><th scope="col" className="py-3 pr-4">Current store</th><th scope="col" className="py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((person) => {
                  const store = person.assignment?.store;
                  const name = [person.first_name, person.last_name].filter(Boolean).join(' ') || 'Staff account';
                  return <tr key={person.id}>
                    <td className="py-4 pr-4"><p className="font-semibold text-slate-800">{name} <span className="text-xs font-normal text-slate-400">#{person.id}</span></p><p className="mt-1 text-xs text-slate-500">{person.email}</p></td>
                    <td className="py-4 pr-4 text-slate-600">{roleLabels[person.role] || person.role}</td>
                    <td className="py-4 pr-4"><span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${person.approved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{person.approved ? 'Approved' : 'Pending approval'}</span></td>
                    <td className="py-4 pr-4">{store ? <><p className="font-medium">{store.store_name} <span className="text-xs text-slate-400">#{store.store_id}</span></p><p className="mt-1 max-w-64 text-xs text-slate-500">{store.address}</p>{store.status === 'inactive' && <p className="mt-1 text-xs font-medium text-amber-800">Inactive store — staff access unavailable</p>}</> : <span className="text-slate-400">Unassigned</span>}</td>
                    <td className="py-4 text-right"><div className="flex justify-end gap-2">{!person.approved && <button type="button" onClick={() => openAction('approve', person)} aria-label={`Approve account for ${person.email}`} className="rounded-lg bg-[#0E5C2F] px-3 py-2 text-xs font-semibold text-white">Approve account</button>}<button type="button" onClick={() => openAction('assign', person)} disabled={!person.approved || stores.length === 0} title={!person.approved ? 'Approve this staff account first' : stores.length === 0 ? 'No active stores available' : undefined} aria-label={`${store ? 'Transfer store' : 'Assign store'} for ${person.email}`} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">{store ? 'Transfer store' : 'Assign store'}</button></div></td>
                  </tr>;
                })}
                {filtered.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-slate-500">{staff.length === 0 ? 'No staff accounts yet. Create the first Inventory Worker or Supervisor account.' : 'No staff accounts match your filters.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </>}
      {action && <StaffActionDialog action={action} stores={stores} onClose={() => setAction(null)} onSave={saveStaff} />}
    </div>
  );
}
