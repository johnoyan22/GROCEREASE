import { useEffect, useState } from 'react';
import { getStockReceiving, submitStockReceiving, decideStockReceiving, quarantineStockBatch, previewStockImport, submitStockImport, downloadStockTemplate, getInventoryItems } from '../../../services/api';

const empty = { kind: 'receive', quantity: '', received_date: '', expiration_date: '', batch_reference: '', description: '', batch_id: '', item: '' };
export default function StockReceivingWorkspace({ supervisor = false }) {
  const [data, setData] = useState(null), [inventory, setInventory] = useState([]), [draft, setDraft] = useState(empty);
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [version, setVersion] = useState(0);
  const [file, setFile] = useState(null), [preview, setPreview] = useState(null), [decision, setDecision] = useState(null), [note, setNote] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([getStockReceiving({ signal: controller.signal }), getInventoryItems({ signal: controller.signal })]).then(([records, items]) => { setData(records); setInventory(items.inventory); }).catch(error => { if (error.name !== 'AbortError') setMessage(error.message); });
    return () => controller.abort();
  }, [version]);
  async function action(callback) {
    if (busy) return;
    setBusy(true); setMessage('');
    try { const result = await callback(); setMessage(result.message); setVersion(v => v + 1); return true; }
    catch (error) { setMessage(error.message || 'The request could not be confirmed. Refresh before repeating it.'); return false; }
    finally { setBusy(false); }
  }
  function change(e) { setDraft(d => ({ ...d, [e.target.name]: e.target.value })); }
  async function submit(e) {
    e.preventDefault();
    if (await action(() => submitStockReceiving(draft.item, { ...draft, quantity: Number(draft.quantity), expiration_date: draft.expiration_date || null, batch_id: draft.batch_id ? Number(draft.batch_id) : null }))) setDraft(empty);
  }
  async function showPreview() {
    setBusy(true); setMessage(''); setPreview(null);
    try { setPreview(await previewStockImport(file)); } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  return <section className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
    <h2 className="text-xl font-semibold">Receiving &amp; batch tracking</h2>
    <p className="text-sm text-slate-600">Deliveries and disposals require Supervisor approval. Expired or quarantined units remain physical stock and cannot be sold. Legacy stock has no inferred batch dates.</p>
    {message && <p role="status" className="rounded-lg bg-slate-50 p-3 text-sm">{message}</p>}
    {!data && !message && <p role="status">Loading batch records…</p>}
    {data && <>
      {!supervisor && <>
        <form onSubmit={submit}><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm">Product<select required name="item" value={draft.item} onChange={change} className="mt-1 w-full rounded-lg border p-2"><option value="">Select product</option>{inventory.map(item => <option key={item.store_inventory_id} value={item.store_inventory_id}>{item.product_name} · {item.sku}</option>)}</select></label>
          <label className="text-sm">Request type<select name="kind" value={draft.kind} onChange={change} className="mt-1 w-full rounded-lg border p-2"><option value="receive">Receive delivery</option><option value="dispose">Dispose batch units</option></select></label>
          <label className="text-sm">Quantity (whole units)<input required type="number" min="1" max="1000000" step="1" name="quantity" value={draft.quantity} onChange={change} className="mt-1 w-full rounded-lg border p-2" /></label>
          <label className="text-sm">Received / disposal date<input required type="date" name="received_date" value={draft.received_date} onChange={change} className="mt-1 w-full rounded-lg border p-2" /></label>
          <label className="text-sm">Expiration date (optional)<input type="date" name="expiration_date" value={draft.expiration_date} onChange={change} className="mt-1 w-full rounded-lg border p-2" /></label>
          <label className="text-sm">Unique delivery / disposal reference<input required maxLength={100} name="batch_reference" value={draft.batch_reference} onChange={change} className="mt-1 w-full rounded-lg border p-2" /></label>
          {draft.kind === 'dispose' && <label className="text-sm">Batch to dispose<select required name="batch_id" value={draft.batch_id} onChange={change} className="mt-1 w-full rounded-lg border p-2"><option value="">Select batch</option>{data.batches.filter(b => String(b.store_inventory_id) === draft.item && b.remaining_qty > 0).map(b => <option key={b.id} value={b.id}>{b.batch_reference} · {b.remaining_qty} physical units</option>)}</select></label>}
          <label className="text-sm sm:col-span-2">Description<textarea required maxLength={1000} name="description" value={draft.description} onChange={change} className="mt-1 w-full rounded-lg border p-2" /></label>
          <button className="self-end rounded-lg bg-green-800 px-4 py-3 text-sm text-white">{busy ? 'Submitting…' : 'Submit for approval'}</button>
        </fieldset></form>
        <div className="space-y-3 rounded-xl bg-slate-50 p-4"><h3 className="font-semibold">Import deliveries from CSV</h3><p className="text-sm">Use your store’s SKUs. Preview validates each row; confirmation submits valid rows for approval.</p><button type="button" onClick={() => action(downloadStockTemplate)} disabled={busy} className="rounded-lg border bg-white px-4 py-2 text-sm">Download CSV template</button><label className="block text-sm">CSV file (up to 500 rows, 1 MB)<input type="file" accept=".csv,text/csv" onChange={e => { setFile(e.target.files?.[0] || null); setPreview(null); }} className="mt-2 w-full" /></label><button type="button" disabled={!file || busy} onClick={showPreview} className="rounded-lg border bg-white px-4 py-2 text-sm">Preview import</button>
          {preview && <><p role="status" className="text-sm">{preview.accepted} valid · {preview.rejected} rejected</p><div className="max-h-72 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>Line</th><th>SKU</th><th>Qty</th><th>Received</th><th>Expires</th><th>Batch</th></tr></thead><tbody>{preview.rows.map(row => <tr key={row.line}><td>{row.line}</td><td>{row.sku}</td><td>{row.quantity}</td><td>{row.received_date}</td><td>{row.expiration_date || '—'}</td><td>{row.batch_reference}</td></tr>)}</tbody></table>{preview.errors.map(row => <p key={row.line} className="mt-2 text-sm text-red-700">Line {row.line}: {row.message}</p>)}</div><button type="button" disabled={!preview.preview_token || busy} onClick={async () => { if (await action(() => submitStockImport(preview.preview_token))) setPreview(null); }} className="rounded-lg bg-green-800 px-4 py-2 text-sm text-white">Submit {preview.accepted} valid rows for approval</button></>}
        </div>
      </>}
      {decision && <form onSubmit={async e => { e.preventDefault(); if (await action(() => decision.type === 'quarantine' ? quarantineStockBatch(decision.id, note) : decideStockReceiving(decision.id, decision.type, note))) { setDecision(null); setNote(''); } }} className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4"><h3 className="font-semibold">{decision.type} #{decision.id}</h3><label className="block text-sm">Review description<textarea required maxLength={1000} value={note} onChange={e => setNote(e.target.value)} className="mt-1 w-full rounded-lg border bg-white p-2" /></label><div className="flex gap-3"><button disabled={busy} className="rounded-lg bg-green-800 px-4 py-2 text-sm text-white">Confirm decision</button><button type="button" onClick={() => setDecision(null)} className="rounded-lg border bg-white px-4 py-2 text-sm">Cancel</button></div></form>}
      <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><caption className="pb-3 text-left font-semibold">Receiving and disposal requests</caption><thead><tr>{['Reference', 'Product', 'Type / Qty', 'Dates', 'Description', 'Status', ...(supervisor ? ['Review'] : [])].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{data.requests.map(row => <tr key={row.id} className="border-t"><td className="p-2">{row.batch_reference}</td><td className="p-2">{inventory.find(i => i.store_inventory_id === row.store_inventory_id)?.product_name || `#${row.store_inventory_id}`}</td><td className="p-2">{row.kind} · {row.quantity}</td><td className="p-2">{row.received_date}<br />{row.expiration_date || 'No expiry recorded'}</td><td className="max-w-64 break-words p-2">{row.description}<br />{row.decision_note}</td><td className="p-2">{row.status}</td>{supervisor && <td className="p-2">{row.status === 'pending' && <div className="flex gap-2">{['approved', 'rejected'].map(type => <button key={type} type="button" disabled={busy} onClick={() => { setDecision({ id: row.id, type }); setNote(''); }} className="rounded border px-3 py-2">{type === 'approved' ? 'Approve' : 'Reject'}</button>)}</div>}</td>}</tr>)}</tbody></table>{!data.requests.length && <p className="py-3 text-sm text-slate-500">No receiving requests.</p>}</div>
      <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><caption className="pb-3 text-left font-semibold">Physical batches</caption><thead><tr>{['Batch', 'Inventory', 'Received', 'Expires', 'Physical remaining', 'Status', ...(supervisor ? ['Action'] : [])].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{data.batches.map(batch => <tr key={batch.id} className="border-t"><td className="p-2">{batch.batch_reference}</td><td className="p-2">#{batch.store_inventory_id}</td><td className="p-2">{batch.received_date}</td><td className="p-2">{batch.expiration_date || 'Not recorded'}</td><td className="p-2">{batch.remaining_qty}</td><td className="p-2">{batch.status}</td>{supervisor && <td className="p-2">{batch.status !== 'quarantined' && batch.remaining_qty > 0 && <button type="button" onClick={() => { setDecision({ id: batch.id, type: 'quarantine' }); setNote(''); }} className="rounded border px-3 py-2">Quarantine</button>}</td>}</tr>)}</tbody></table></div>
    </>}
  </section>;
}
