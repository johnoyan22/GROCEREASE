import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

export default function StaffAssignmentDialog({ staff, store, onClose, onSave, onRefresh }) {
  const dialogRef = useRef(null);
  const pending = useRef(false);
  const titleId = useId();
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');
  const [errorStatus, setErrorStatus] = useState(null);
  const [details, setDetails] = useState('');
  const name = [staff.first_name, staff.last_name].filter(Boolean).join(' ') || staff.email;

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
    setDetails('');
    setErrorStatus(null);
    try {
      await onSave(staff.id);
    } catch (error) {
      setErrorStatus(error.status);
      setDetails(error.errors?.user?.[0] || '');
      setFailure(error.status === 409
        ? 'This Inventory Worker is already assigned to another store. Only Admin can transfer staff. Refresh the list to see the latest available accounts.'
        : error.status === 422
          ? 'This account is no longer eligible for assignment. Refresh the staff list.'
          : error.status === 401
            ? 'Your session has expired. Please sign in again.'
            : error.status === 403
              ? 'Assignment is unavailable. Your Supervisor approval or active store assignment may have changed. Close and refresh, or contact Admin.'
              : error.status === 404
                ? 'This staff account is no longer available. Refresh the list.'
                : error.status === 419
                  ? 'Your security session expired. Refresh this page and try again.'
                  : error.status === 429
                    ? 'Too many assignment attempts. Please wait a minute before trying again.'
                    : 'Could not confirm whether the assignment was saved. Refresh the staff list before trying again.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }} className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-0 text-slate-800 shadow-xl backdrop:bg-black/40">
      <form onSubmit={submit} className="space-y-4 p-6">
        <h2 id={titleId} className="text-lg font-bold">Assign Inventory Worker</h2>
        {failure && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800"><p>{failure}</p>{details && <p className="mt-1">{details}</p>}{errorStatus === 401 && <Link to="/login" className="mt-2 inline-block underline">Sign in again</Link>}</div>}
        <div className="rounded-xl border border-slate-200 p-4 text-sm">
          <p className="font-semibold">{name} <span className="font-normal text-slate-400">#{staff.id}</span></p>
          <p className="mt-1 break-all text-slate-500">{staff.email}</p>
          <p className="mt-2 text-xs font-medium text-green-700">Admin-approved Inventory Worker</p>
        </div>
        <div className="rounded-xl bg-green-50 p-4 text-sm">
          <p className="text-xs font-medium text-green-800">Your assigned store</p>
          <p className="mt-1 font-semibold">{store.store_name} (#{store.store_id})</p>
          <p className="mt-1 text-slate-600">{store.address}</p>
        </div>
        <p className="text-sm text-slate-600">Assign this available Inventory Worker to your store? Store access begins after the assignment is saved. Transfers between stores are handled by Admin.</p>
        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm disabled:opacity-50">Cancel</button>
          {failure && <button type="button" disabled={saving} onClick={onRefresh} className="rounded-lg border border-green-700 px-4 py-2.5 text-sm font-medium text-green-700 disabled:opacity-50">Refresh staff list</button>}
          <button type="submit" disabled={saving || Boolean(failure)} className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50">{saving ? 'Assigning...' : 'Assign to my store'}</button>
        </div>
      </form>
    </dialog>
  );
}
