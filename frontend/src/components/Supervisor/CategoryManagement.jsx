import { useRef, useState } from 'react';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../services/api';
import useStorePage from '../../hooks/useStorePage';
import useModalFocus from '../../hooks/useModalFocus';
import StoreSelector from '../inventory/layout/StoreSelector';

const button = 'shrink-0 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-40';
const primary = 'rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-40';

function CategoryModal({ category, onClose, onSaved, deleting = false }) {
  const dialog = useRef(null), pending = useRef(false);
  useModalFocus(dialog, () => { if (!busy) onClose(); });
  const [name, setName] = useState(category?.name ?? '');
  const [status, setStatus] = useState(category?.status ?? 'active');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const result = deleting ? await deleteCategory(category.id) : category ? await updateCategory(category.id, { name, status }) : await createCategory({ name, status });
      onSaved(result.message);
    } catch (failure) { setError(failure.status === 404 ? 'This category is no longer in your assigned store. Close the form and refresh.' : failure.errors?.name?.[0] || failure.message); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><section ref={dialog} role="dialog" tabIndex={-1} aria-modal="true" aria-labelledby="category-modal-title" className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
    <h2 id="category-modal-title" className="text-lg font-bold">{deleting ? 'Delete Category' : category ? 'Edit Category' : 'Add Category'}</h2>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <form onSubmit={submit} className="mt-4 space-y-4"><fieldset disabled={busy} className="space-y-4">
      {deleting ? <p className="break-words text-sm">Delete “{category.name}”? Only a category that has never been used can be deleted.</p> : <><label className="block text-sm font-medium">Category Name<input data-initial-focus required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5" /></label><label className="block text-sm font-medium">Status<select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5"><option value="active">Active</option><option value="inactive">Inactive</option></select></label></>}
      <div className="flex justify-end gap-3 border-t pt-4"><button type="button" onClick={onClose} className={button}>Cancel</button><button className={deleting ? 'rounded-lg bg-red-700 px-4 py-2 text-sm text-white' : primary}>{busy ? 'Saving…' : deleting ? 'Delete Category' : 'Save Category'}</button></div>
    </fieldset></form>
  </section></div>;
}

export default function CategoryManagement() {
  const [search, setSearch] = useState(''), [status, setStatus] = useState(''), [page, setPage] = useState(1);
  const [modal, setModal] = useState(null), [notice, setNotice] = useState(''), [failure, setFailure] = useState(''), [pending, setPending] = useState(null);
  const busy = useRef(false);
  const state = useStorePage(getCategories, { search, status, page });
  const meta = state.data?.pagination;
  function saved(message) { setModal(null); setNotice(message); setFailure(''); state.reload(); }
  async function toggle(row) {
    if (busy.current) return; busy.current = true; setPending(row.id); setFailure(''); setNotice('');
    try { saved((await updateCategory(row.id, { name: row.name, status: row.status === 'active' ? 'inactive' : 'active' })).message); }
    catch (e) { setFailure(e.message); }
    finally { busy.current = false; setPending(null); }
  }
  return <div>
    <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row"><h1 className="text-2xl font-bold">Category Management</h1><StoreSelector store={state.store} loading={state.loading} error={state.error} /></div>
    <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row"><div className="flex min-w-0 flex-1 flex-wrap gap-3"><input type="search" aria-label="Search categories" maxLength={100} placeholder="Search category name" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="min-w-0 flex-1 rounded-lg border bg-white p-2.5 text-sm" /><select aria-label="Category status filter" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-lg border bg-white p-2.5 text-sm"><option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div><button disabled={!state.store || Boolean(state.error)} onClick={() => setModal({ category: null })} className={primary}>+ Add Category</button></div>
    {notice && <p role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    {(state.error || failure) && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{failure || state.error}<button onClick={state.reload} className="ml-3 underline">Retry</button></p>}
    {state.loading && <p role="status">Loading categories…</p>}
    {state.data && (
      <section aria-label="Categories" className="w-full overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] table-fixed text-left text-sm">
            <colgroup><col className="w-[30%] lg:w-2/5" /><col className="w-1/5" /><col className="w-1/2 lg:w-2/5" /></colgroup>
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th scope="col" className="px-4 py-4 sm:px-6">Category Name</th>
                <th scope="col" className="px-4 py-4 text-center sm:px-6">Status</th>
                <th scope="col" className="px-4 py-4 text-right sm:px-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {state.data.categories.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/70">
                  <td className="break-words px-4 py-5 align-middle sm:px-6">
                    <p className="font-medium text-gray-900">{row.name}</p>
                    {!row.can_delete && <p className="mt-1 text-xs font-normal leading-5 text-gray-500">Used by products; set Inactive to retire.</p>}
                  </td>
                  <td className="px-4 py-5 text-center align-middle sm:px-6">
                    <span className={'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium capitalize ' + (row.status === 'active' ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-600')}>{row.status}</span>
                  </td>
                  <td className="px-4 py-5 align-middle sm:px-6">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button onClick={() => setModal({ category: row })} className={button}>Edit<span className="sr-only"> {row.name}</span></button>
                      <button disabled={pending !== null} onClick={() => toggle(row)} className={button}>{pending === row.id ? 'Saving…' : row.status === 'active' ? 'Deactivate' : 'Reactivate'}<span className="sr-only"> {row.name}</span></button>
                      {row.can_delete && <button onClick={() => setModal({ category: row, deleting: true })} className={button + ' text-red-700'}>Delete<span className="sr-only"> {row.name}</span></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {state.data.categories.length === 0 && <tr><td colSpan={3} className="px-6 py-12 text-center text-sm text-gray-600">No matching categories. Add a category to make it available in product forms.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50/50 px-4 py-4 text-sm sm:px-6">
          <p className="text-gray-600">Showing {meta.from ?? 0}–{meta.to ?? 0} of {meta.total} · Page {meta.current_page} of {meta.last_page}</p>
          <div className="flex gap-2"><button className={button} disabled={meta.current_page <= 1} onClick={() => setPage(meta.current_page - 1)}>Previous</button><button className={button} disabled={meta.current_page >= meta.last_page} onClick={() => setPage(meta.current_page + 1)}>Next</button></div>
        </div>
      </section>
    )}
    {modal && <CategoryModal {...modal} onClose={() => setModal(null)} onSaved={saved} />}
  </div>;
}
