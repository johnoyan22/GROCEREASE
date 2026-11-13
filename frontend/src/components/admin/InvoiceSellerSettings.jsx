import { useEffect, useState } from 'react';
import { getAdminStores, getInvoiceSettings, saveInvoiceSettings } from '../../services/api';

const empty = { registered_name: '', registered_address: '', tin: '', branch_code: '', tax_registration: 'unconfirmed', numbering_authority: '', review_notes: '' };
export default function InvoiceSellerSettings() {
  const [stores, setStores] = useState([]), [storeId, setStoreId] = useState(''), [draft, setDraft] = useState(empty), [loadedStore, setLoadedStore] = useState(null), [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { const controller = new AbortController(); getAdminStores({ signal: controller.signal }).then(result => setStores(result.stores)).catch(e => { if (e.name !== 'AbortError') setError(e.message); }); return () => controller.abort(); }, []);
  useEffect(() => {
    if (!storeId) return;
    const controller = new AbortController();
    getInvoiceSettings(storeId, { signal: controller.signal }).then(result => { setDraft({ ...empty, ...Object.fromEntries(Object.entries(result.settings || {}).filter(([key]) => key in empty).map(([key,value]) => [key, value ?? ''])) }); setLoadedStore(storeId); }).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, [storeId]);
  async function save(e) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { setMessage((await saveInvoiceSettings(storeId, Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value || null])))).message); } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-xl font-semibold">Seller invoice details</h2><p className="mt-2 text-sm text-slate-600">Record only supermarket-approved registration details. Documents remain Draft / Pro Forma. Official issuance, tax calculations and BIR authorization require separate review.</p>
    <label className="mt-4 block text-sm">Supermarket<select value={storeId} onChange={e => { setStoreId(e.target.value); setLoadedStore(null); setError(''); setMessage(''); }} className="mt-1 w-full rounded-lg border p-2"><option value="">Choose a store</option>{stores.map(store => <option key={store.store_id} value={store.store_id}>{store.store_name}</option>)}</select></label>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="mt-3 text-sm text-green-800">{message}</p>}
    {loadedStore === storeId && storeId && <form onSubmit={save} className="mt-4"><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">{[['registered_name','BIR registered name'],['registered_address','Registered address'],['tin','TIN'],['branch_code','Branch code'],['numbering_authority','Numbering authority / approval reference']].map(([name,label]) => <label key={name} className="text-sm">{label}<input maxLength={name === 'registered_address' ? 500 : name === 'tin' ? 30 : name === 'branch_code' ? 10 : 255} value={draft[name]} onChange={e => setDraft(d => ({ ...d, [name]: e.target.value }))} className="mt-1 w-full rounded-lg border p-2" /></label>)}<label className="text-sm">Tax registration<select value={draft.tax_registration} onChange={e => setDraft(d => ({ ...d, tax_registration: e.target.value }))} className="mt-1 w-full rounded-lg border p-2"><option value="unconfirmed">Unconfirmed</option><option value="vat">VAT registered</option><option value="non_vat">Non-VAT registered</option></select></label><label className="text-sm sm:col-span-2">Review evidence / notes<textarea required maxLength={2000} value={draft.review_notes} onChange={e => setDraft(d => ({ ...d, review_notes: e.target.value }))} className="mt-1 w-full rounded-lg border p-2" /></label><button className="rounded-lg bg-green-800 px-4 py-2 text-sm text-white">{busy ? 'Saving…' : 'Save approved seller details'}</button></fieldset></form>}
  </section>;
}
