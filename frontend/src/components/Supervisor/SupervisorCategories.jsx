import { useEffect, useState } from 'react';
import { getStoreCategories, saveStoreCategory } from '../../services/api';

export default function SupervisorCategories() {
  const [categories, setCategories] = useState([]);
  const [draft, setDraft] = useState({ name: '', active: true });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getStoreCategories({ signal: controller.signal }).then(data => setCategories(data.categories)).catch(error => { if (error.name !== 'AbortError') setMessage(error.message); });
    return () => controller.abort();
  }, [version]);
  async function save(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    try { const result = await saveStoreCategory(draft.id, { name: draft.name.trim(), active: draft.active }); setMessage(result.message); setDraft({ name: '', active: true }); setVersion(v => v + 1); }
    catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  return <section className="rounded-xl border border-slate-200 bg-white p-5">
    <h2 className="text-xl font-semibold">Store categories</h2><p className="mt-2 text-sm text-slate-600">Archiving stops new assignments. Existing products and purchase history are retained.</p>
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    <form onSubmit={save} className="mt-4 flex flex-wrap items-end gap-3"><label className="flex-1 text-sm">Category name<input required maxLength={100} value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} className="mt-1 w-full rounded-lg border p-2" /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={e => setDraft(d => ({ ...d, active: e.target.checked }))} />Active</label><button disabled={busy} className="rounded-lg bg-green-800 px-4 py-2 text-sm text-white">{busy ? 'Saving…' : draft.id ? 'Save category' : 'Add category'}</button>{draft.id && <button type="button" onClick={() => setDraft({ name: '', active: true })} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>}</form>
    <ul className="mt-5 divide-y divide-slate-200">{categories.map(category => <li key={category.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><strong>{category.name}</strong><p className="text-sm text-slate-600">{category.products_count} products · {category.active ? 'Active' : 'Archived'}</p></div><button type="button" onClick={() => { setDraft(category); setMessage(''); }} className="rounded-lg border px-4 py-2 text-sm">Edit {category.name}</button></li>)}</ul>
    {categories.length === 0 && <p className="mt-4 text-sm text-slate-600">No categories loaded. Add a category before workers create products.</p>}
  </section>;
}
