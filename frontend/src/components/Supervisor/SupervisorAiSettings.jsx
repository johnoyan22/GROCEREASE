import { useEffect, useState } from 'react';
import { getAiSettings, saveAiSettings } from '../../services/habelApi';

export default function SupervisorAiSettings() {
  const [result, setResult] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getAiSettings({ signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) { setResult(data); setForm(data.data); setError(''); }
    }).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [version]);
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const data = await saveAiSettings(form);
      setResult(data); setForm(data.data); setNotice('Recommendation settings saved.');
    } catch (err) { setError(Object.values(err.errors ?? {}).flat()[0] || err.message); }
    finally { setBusy(false); }
  }
  function toggle(field, category) {
    setForm(current => ({ ...current, [field]: current[field].includes(category) ? current[field].filter(value => value !== category) : [...current[field], category] }));
  }
  const categories = [...new Set([...(result?.categories ?? []), ...(form?.included_categories ?? []), ...(form?.excluded_categories ?? [])])];
  return <section aria-label="AI recommendation settings" className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
    <div className="flex justify-between gap-4"><h2 className="text-lg font-bold">AI Recommendation Management</h2><button type="button" disabled={busy} onClick={() => { setNotice(''); setVersion(v => v + 1); }} className="text-sm text-green-800 underline">Refresh AI settings</button></div>
    {error && <p role="alert" className="my-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="my-3 text-sm text-green-800">{notice}</p>}
    {!form ? <p className="mt-3 text-sm">{error ? 'Settings unavailable. Check your approved store assignment and AI database setup.' : 'Loading recommendation settings...'}</p> : <form onSubmit={save} className="mt-4 space-y-4">
      <p className="font-semibold">{result.store.store_name}</p>
      <p className="text-xs text-gray-600">{result.dataset_rule}</p>
      <fieldset disabled={busy} className="space-y-4">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} />Enable recommendations</label>
        <label className="block text-sm">Maximum recommendations<input type="number" min="1" max="12" required value={form.max_items} onChange={e => setForm({ ...form, max_items: Number(e.target.value) })} className="ml-3 w-20 rounded border p-2" /></label>
        <label className="block text-sm">Ranking basis<select value={form.ranking_basis} onChange={e => setForm({ ...form, ranking_basis: e.target.value })} className="ml-3 rounded border p-2"><option value="hybrid">Purchase history, popularity and cart context</option><option value="purchase_history">Completed purchase history</option><option value="popularity">Completed purchase popularity</option></select></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.include_alternatives} onChange={e => setForm({ ...form, include_alternatives: e.target.checked })} />Enable alternative suggestions</label>
        <div className="grid gap-4 sm:grid-cols-2">{[['included_categories', 'Included categories (empty means all)'], ['excluded_categories', 'Excluded categories']].map(([field, label]) => <fieldset key={field} className="rounded border p-3"><legend className="px-1 text-sm font-semibold">{label}</legend>{categories.length === 0 && <p className="text-xs">This store has no catalog categories yet.</p>}{categories.map(category => <label key={category} className="my-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={form[field].includes(category)} onChange={() => toggle(field, category)} />{category}</label>)}</fieldset>)}</div>
        <button type="submit" className="rounded bg-green-700 px-4 py-2 text-sm text-white">{busy ? 'Saving...' : 'Save recommendation settings'}</button>
      </fieldset>
      <p className="text-xs text-gray-500">{form.updated_at ? 'Last saved: ' + form.updated_at + ' by user #' + form.updated_by : 'Default settings; no saved changes yet.'}</p>
      {result.audit?.length > 0 && <details className="text-xs text-gray-600"><summary>Recent setting changes</summary><ul>{result.audit.map(entry => <li key={entry.id}>User #{entry.changed_by} — {entry.created_at}</li>)}</ul></details>}
    </form>}
  </section>;
}
