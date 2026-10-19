import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

export default function StoreActionDialog({ action, onClose, onSave }) {
  const dialogRef = useRef(null);
  const pending = useRef(false);
  const id = useId();
  const store = action.store;
  const changingStatus = action.mode === 'status';
  const deactivating = changingStatus && store.status === 'active';
  const [form, setForm] = useState({ store_name: store?.store_name ?? '', address: store?.address ?? '' });
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');
  const [errors, setErrors] = useState({});
  const [errorStatus, setErrorStatus] = useState(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setFailure('');
    setErrors({});
    setErrorStatus(null);
    try {
      await onSave(changingStatus
        ? { status: deactivating ? 'inactive' : 'active' }
        : { store_name: form.store_name.trim(), address: form.address.trim() });
    } catch (error) {
      setErrorStatus(error.status);
      setErrors(error.errors || {});
      setFailure(error.status === 401
        ? 'Your session has expired. Please sign in again.'
        : error.status === 403
          ? 'Only an Admin can manage stores.'
          : error.status === 404
            ? 'This store is no longer available. Close this form and refresh.'
            : error.status === 419
              ? 'Your security session expired. Refresh this page and try again.'
              : error.status && error.status < 500
                ? error.message
                : 'Could not confirm that the change was saved. Close this form and refresh the store list before trying again.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  const title = changingStatus ? (deactivating ? 'Deactivate Store' : 'Reactivate Store')
    : action.mode === 'create' ? 'Create Store' : 'Edit Store Details';
  const submitLabel = changingStatus ? (deactivating ? 'Deactivate store' : 'Reactivate store')
    : action.mode === 'create' ? 'Create store' : 'Save store details';
  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100';

  return (
    <dialog ref={dialogRef} aria-labelledby={`${id}-title`} onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }} className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-0 text-slate-800 shadow-xl backdrop:bg-black/40">
      <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
        <div><h2 id={`${id}-title`} className="text-lg font-bold">{title}</h2>{store && <p className="mt-1 text-sm text-slate-500">{store.store_name} (#{store.store_id})</p>}</div>
        <button type="button" aria-label="Close store form" onClick={onClose} disabled={saving} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X size={18} /></button>
      </div>
      <form onSubmit={submit} className="space-y-4 p-6">
        {failure && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800"><p>{failure}</p>{errorStatus === 401 && <Link to="/login" className="mt-1 inline-block underline">Sign in again</Link>}</div>}
        {changingStatus ? <>
          <div className="rounded-lg bg-slate-50 p-3 text-sm"><p>{store.address}</p><p className="mt-1 text-slate-500">{store.assigned_staff_count} assigned staff account(s)</p></div>
          <p className={`rounded-lg border p-4 text-sm ${deactivating ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
            {deactivating
              ? 'Deactivating this store blocks its staff from store operations and removes it from new staff assignment choices. Products, inventory, and current staff assignments will be preserved.'
              : 'Reactivating this store makes it available for staff assignments and restores access for approved staff who are still assigned here.'}
          </p>
          {errors.status && <p className="text-sm text-red-700">{errors.status[0]}</p>}
        </> : <>
          <label className="block text-sm font-medium">Store name
            <input name="store_name" required maxLength={100} value={form.store_name} onChange={(event) => setForm((current) => ({ ...current, store_name: event.target.value }))} disabled={saving} aria-invalid={Boolean(errors.store_name)} aria-describedby={errors.store_name ? `${id}-store-name-error` : undefined} className={inputClass} />
            {errors.store_name && <span id={`${id}-store-name-error`} className="mt-1 block text-xs text-red-700">{errors.store_name[0]}</span>}
          </label>
          <label className="block text-sm font-medium">Store address
            <textarea name="address" required maxLength={255} rows={3} value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} disabled={saving} aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? `${id}-address-error` : undefined} className={inputClass} />
            {errors.address && <span id={`${id}-address-error`} className="mt-1 block text-xs text-red-700">{errors.address[0]}</span>}
          </label>
          <p className="text-xs text-slate-500">{action.mode === 'create' ? 'New stores start Active and become available in Staff Management assignment choices.' : 'These changes update the store name and address. Use the separate status action to deactivate or reactivate the store.'}</p>
        </>}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={saving || [401, 403, 404].includes(errorStatus)} className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${deactivating ? 'bg-amber-700 hover:bg-amber-800' : 'bg-[#0E5C2F] hover:bg-emerald-900'}`}>{saving ? 'Saving...' : submitLabel}</button>
        </div>
      </form>
    </dialog>
  );
}
