import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100';

export default function StaffActionDialog({ action, stores, onClose, onSave }) {
  const dialogRef = useRef(null);
  const id = useId();
  const creating = action.mode === 'create';
  const assigning = action.mode === 'assign';
  const staff = action.staff;
  const currentStore = staff?.assignment?.store;
  const name = [staff?.first_name, staff?.last_name].filter(Boolean).join(' ') || staff?.email;
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone_number: '', address: '',
    role: 'inventory_worker', password: '', password_confirmation: '',
    store_id: currentStore ? String(currentStore.store_id) : '',
  });
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');
  const [errors, setErrors] = useState({});
  const [errorStatus, setErrorStatus] = useState(null);
  const pending = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  function change(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setFailure('');
    setErrors({});
    setErrorStatus(null);
    try {
      const details = creating ? {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone_number: form.phone_number.trim(),
        address: form.address.trim() || null,
        role: form.role,
        password: form.password,
        password_confirmation: form.password_confirmation,
      } : assigning ? { store_id: Number(form.store_id) } : {};
      await onSave(details);
    } catch (error) {
      setErrors(error.errors || {});
      setErrorStatus(error.status);
      setFailure(error.status === 401
        ? 'Your session has expired. Please sign in again.'
        : error.status === 403
          ? 'Only an Admin can perform this action.'
          : error.status === 404
            ? 'This staff account is no longer available. Close this form and refresh.'
            : error.status === 419
              ? 'Your security session expired. Refresh this page and try again.'
              : error.status && error.status < 500
                ? error.message
                : 'Could not confirm that the change was saved. Close this form and refresh the staff list before trying again.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  const title = creating ? 'Create Staff Account' : assigning ? 'Staff Store Assignment' : 'Approve Staff Account';
  const selectedStore = stores.find((store) => String(store.store_id) === form.store_id);
  const unchangedStore = assigning && staff?.assignment && String(staff.assignment.store_id) === form.store_id;
  const submitLabel = creating ? 'Create and approve account' : assigning ? (currentStore ? 'Transfer to store' : 'Assign to store') : 'Approve account';
  const fields = [
    ['first_name', 'First name', 'text', 'given-name', 255],
    ['last_name', 'Last name', 'text', 'family-name', 255],
    ['email', 'Email', 'email', 'off', 255],
    ['phone_number', 'Phone number', 'tel', 'off', 13],
    ['password', 'Password', 'password', 'new-password', undefined],
    ['password_confirmation', 'Confirm password', 'password', 'new-password', undefined],
  ];

  function fieldError(field) {
    return errors[field] && <span id={`${id}-${field}-error`} className="mt-1 block text-xs text-red-700">{errors[field][0]}</span>;
  }

  return (
    <dialog ref={dialogRef} aria-labelledby={`${id}-title`} onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }} className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl bg-white p-0 text-slate-800 shadow-xl backdrop:bg-black/40">
      <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
        <div>
          <h2 id={`${id}-title`} className="text-lg font-bold">{title}</h2>
          {!creating && <p className="mt-1 text-sm text-slate-500">{name} ({staff.email})</p>}
        </div>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Close staff form" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X size={18} /></button>
      </div>
      <form onSubmit={submit} className="space-y-4 p-6">
        {failure && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800"><p>{failure}</p>{errorStatus === 401 && <Link to="/login" className="mt-1 inline-block underline">Sign in again</Link>}{errors.user && <p className="mt-1">{errors.user[0]}</p>}</div>}
        {creating && <>
          <p className="text-sm text-slate-600">Create an Inventory Worker or Supervisor login account. The account receives your Admin approval; email verification is separate.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map(([field, label, type, autoComplete, maxLength]) => (
              <label key={field} className="block text-sm font-medium">{label}
                <input name={field} type={type} autoComplete={autoComplete} value={form[field]} onChange={change} required maxLength={maxLength} minLength={type === 'password' ? 8 : undefined} pattern={field === 'phone_number' ? '(09[0-9]{9}|\\+639[0-9]{9})' : undefined} placeholder={field === 'phone_number' ? '09XXXXXXXXX or +639XXXXXXXXX' : undefined} disabled={saving} aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `${id}-${field}-error` : undefined} className={inputClass} />
                {fieldError(field)}
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-500">Passwords need at least 8 characters and at most 72 bytes. Use the same password in both fields.</p>
          <label className="block text-sm font-medium">Staff role
            <select name="role" value={form.role} onChange={change} disabled={saving} aria-invalid={Boolean(errors.role)} aria-describedby={errors.role ? `${id}-role-error` : undefined} className={inputClass}>
              <option value="inventory_worker">Inventory Worker</option><option value="supervisor">Supervisor</option>
            </select>
            {fieldError('role')}
          </label>
          <label className="block text-sm font-medium">Address (optional)
            <input name="address" value={form.address} onChange={change} maxLength={255} disabled={saving} aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? `${id}-address-error` : undefined} className={inputClass} />
            {fieldError('address')}
          </label>
          <p className="text-xs text-slate-500">After creation, use Assign store in the staff list to choose an active store.</p>
        </>}
        {assigning && <>
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="font-medium">Current store</p>
            <p>{currentStore ? `${currentStore.store_name} (#${currentStore.store_id})` : 'Unassigned'}{currentStore?.status === 'inactive' ? ' — Inactive' : ''}</p>
            {currentStore?.address && <p className="mt-1 text-xs text-slate-500">{currentStore.address}</p>}
          </div>
          <label className="block text-sm font-medium">Assign to active store
            <select name="store_id" value={form.store_id} onChange={change} required disabled={saving || stores.length === 0} aria-invalid={Boolean(errors.store_id)} aria-describedby={errors.store_id ? `${id}-store_id-error` : undefined} className={inputClass}>
              <option value="">Choose a store</option>
              {currentStore?.status === 'inactive' && !stores.some((store) => store.store_id === currentStore.store_id) && <option value={currentStore.store_id} disabled>{currentStore.store_name} (Inactive)</option>}
              {stores.map((store) => <option key={store.store_id} value={store.store_id}>{store.store_name} (#{store.store_id}) — {store.address}</option>)}
            </select>
            {fieldError('store_id')}
          </label>
          {stores.length === 0 && <p className="text-sm text-amber-800">No active stores are available.</p>}
          {selectedStore && !unchangedStore && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{currentStore ? `Transfer this staff account from ${currentStore.store_name} (#${currentStore.store_id}) to` : 'Assign this staff account to'} {selectedStore.store_name} (#{selectedStore.store_id}). Their store access will follow this assignment.</p>}
          {unchangedStore && <p className="text-xs text-slate-500">This account is already assigned to the selected store.</p>}
        </>}
        {!creating && !assigning && <p className="text-sm text-slate-600">Approve this existing staff account for store assignment and staff operations? Approval will be recorded under your Admin account.</p>}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={saving || (assigning && (!selectedStore || unchangedStore)) || [401, 403, 404].includes(errorStatus)} className="rounded-lg bg-[#0E5C2F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50">{saving ? 'Saving...' : submitLabel}</button>
        </div>
      </form>
    </dialog>
  );
}
