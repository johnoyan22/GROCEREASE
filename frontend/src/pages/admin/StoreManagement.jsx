import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import StoreActionDialog from '../../components/admin/StoreActionDialog';
import StorePickupSettings from '../../components/admin/StorePickupSettings';
import useAdminStores from '../../hooks/useAdminStores';
import { createAdminStore, updateAdminStore, updateAdminStoreStatus } from '../../services/api';

export default function StoreManagement() {
  const { stores, loading, error, errorStatus, reload } = useAdminStores();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [action, setAction] = useState(null);
  const [success, setSuccess] = useState('');
  const [pickupStore, setPickupStore] = useState(null);
  const filtered = stores.filter((store) => [store.store_id, store.store_name, store.address].join(' ').toLowerCase().includes(search.trim().toLowerCase()) && (!status || store.status === status));
  const summary = [
    ['Registered stores', stores.length],
    ['Active stores', stores.filter((store) => store.status === 'active').length],
    ['Inactive stores', stores.filter((store) => store.status === 'inactive').length],
  ];

  function openAction(mode, store) {
    setSuccess('');
    setAction({ mode, store });
  }

  async function saveStore(details) {
    const result = action.mode === 'create'
      ? await createAdminStore(details)
      : action.mode === 'edit'
        ? await updateAdminStore(action.store.store_id, details)
        : await updateAdminStoreStatus(action.store.store_id, details.status);
    if (action.mode === 'create') { setSearch(''); setStatus(''); }
    setSuccess(result.message || 'Store changes saved.');
    setAction(null);
    reload();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-slate-900">Store Management</h1><p className="mt-1 text-sm text-slate-500">Register stores, update their details, and manage active status.</p></div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/staff" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium">Manage staff</Link>
          <button type="button" disabled={loading || Boolean(action)} onClick={() => { setSuccess(''); reload(); }} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium disabled:opacity-50"><RefreshCw size={16} /> Refresh</button>
          <button type="button" disabled={loading || Boolean(error) || Boolean(action)} onClick={() => openAction('create')} className="flex items-center gap-2 rounded-xl bg-[#0E5C2F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"><Plus size={16} /> Create Store</button>
        </div>
      </div>
      {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}
      {loading && <p role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading stores...</p>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{error}</p>{errorStatus === 401 ? <Link to="/login" className="mt-2 inline-block underline">Sign in again</Link> : <button type="button" onClick={reload} className="mt-2 font-semibold underline">Retry</button>}</div>}
      {!loading && !error && <>
        <div className="grid gap-4 sm:grid-cols-3">{summary.map(([label, count]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-800">{count}</p></div>)}</div>
        <section aria-label="Registered stores" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-100 p-5 sm:grid-cols-[minmax(180px,1fr)_180px_auto]">
            <input aria-label="Search stores" type="search" placeholder="Search store name, address, or ID" value={search} onChange={(event) => setSearch(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
            <select aria-label="Filter store status" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
            <button type="button" onClick={() => { setSearch(''); setStatus(''); }} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm">Clear</button>
          </div>
          <p className="px-5 pt-4 text-xs text-slate-500">Showing {filtered.length} of {stores.length} stores</p>
          <div className="overflow-x-auto p-5 pt-2">
            <table className="w-full min-w-[750px] text-left text-sm">
              <caption className="sr-only">Registered stores, status, assigned staff count and management actions</caption>
              <thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th scope="col" className="py-3 pr-4">Store</th><th scope="col" className="py-3 pr-4">Address</th><th scope="col" className="py-3 pr-4">Status</th><th scope="col" className="py-3 pr-4">Assigned staff</th><th scope="col" className="py-3">Pickup</th><th scope="col" className="py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((store) => <tr key={store.store_id}>
                  <td className="py-4 pr-4"><p className="max-w-64 break-words font-semibold">{store.store_name}</p><p className="mt-1 text-xs text-slate-400">Store #{store.store_id}</p></td>
                  <td className="max-w-72 break-words py-4 pr-4 text-slate-600">{store.address}</td>
                  <td className="py-4 pr-4"><span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${store.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{store.status === 'active' ? 'Active' : 'Inactive'}</span></td>
                  <td className="py-4 pr-4 text-slate-600">{store.assigned_staff_count}</td>
                  <td className="py-4"><button type="button" onClick={function () { setPickupStore(store); }} className="rounded-lg border border-green-700 px-3 py-2 text-xs text-green-800">Pickup hours</button></td>
                  <td className="py-4 text-right"><div className="flex justify-end gap-2"><button type="button" onClick={() => openAction('edit', store)} aria-label={`Edit ${store.store_name} (store ${store.store_id})`} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Edit details</button><button type="button" onClick={() => openAction('status', store)} aria-label={`${store.status === 'active' ? 'Deactivate' : 'Reactivate'} ${store.store_name} (store ${store.store_id})`} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${store.status === 'active' ? 'border-amber-200 text-amber-800 hover:bg-amber-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>{store.status === 'active' ? 'Deactivate' : 'Reactivate'}</button></div></td>
                </tr>)}
                {filtered.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-slate-500">{stores.length === 0 ? 'No stores registered yet. Create the first store.' : 'No stores match your filters.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </>}
      {action && <StoreActionDialog action={action} onClose={() => setAction(null)} onSave={saveStore} />}
      {pickupStore && <StorePickupSettings store={pickupStore} onClose={function () { setPickupStore(null); }} />}
    </div>
  );
}
