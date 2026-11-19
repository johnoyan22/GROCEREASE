import { channelLabel, providerLabel } from '../../services/payments';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFinancialBill, getFinancialOptions, getFinancialWorkspace, postFinancial } from '../../services/api';
import { financialKey, financialPayload, phpInput } from '../../services/financial';
import { formatCentavos as money } from '../../services/money';

const field = 'mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm';
const primary = 'rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50';
const secondary = 'rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50';
const at = value => value ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value.replace(' ', 'T') + (/Z|[+]\d\d:\d\d$/.test(value) ? '' : 'Z'))) : '-';
const titles = { agreement: 'Edit agreement', bill: 'Add billing record', payment: 'Record payment', verify: 'Verify payment', reverse_payment: 'Reverse payment',
  contribute: 'Contribute funds', void_bill: 'Void bill', return_contribution: 'Return contribution', policy: 'Save financial settings' };

function Dialog({ title, busy, close, children }) {
  const ref = useRef(null);
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) close(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl border border-gray-200 p-5 backdrop:bg-black/40">
    <header className="mb-4 flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">{title}</h2><button type="button" aria-label="Close dialog" disabled={busy} onClick={close} className={secondary}>Close</button></header>{children}
  </dialog>;
}
function Pages({ records, onPage, disabled }) {
  return records && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm"><p>{records.total} records | Page {records.current_page} of {records.last_page}</p><div className="flex gap-2"><button type="button" disabled={disabled || records.current_page <= 1} onClick={() => onPage(records.current_page - 1)} className={secondary}>Previous</button><button type="button" disabled={disabled || records.current_page >= records.last_page} onClick={() => onPage(records.current_page + 1)} className={secondary}>Next</button></div></div>;
}
function Table({ columns, rows, render }) {
  return rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-gray-300"><tr>{columns.map(c => <th key={c} scope="col" className="px-3 py-3 font-semibold">{c}</th>)}</tr></thead><tbody className="divide-y divide-gray-200">{rows.map(render)}</tbody></table></div> : <p className="py-8 text-sm text-gray-600">No records in this store and mode.</p>;
}

export default function FinancialSetup() {
  const [options, setOptions] = useState(null), [store, setStore] = useState(''), [mode, setMode] = useState('actual');
  const [tab, setTab] = useState('subscriptions'), [history, setHistory] = useState(false), [page, setPage] = useState(1);
  const [status, setStatus] = useState('all'), [from, setFrom] = useState(''), [until, setUntil] = useState('');
  const [data, setData] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0), [modal, setModal] = useState(null), [form, setForm] = useState({}), [formError, setFormError] = useState(''), [busy, setBusy] = useState(false);
  const [details, setDetails] = useState(null);
  const posting = useRef(false), requestKey = useRef(null);
  useEffect(() => {
    if (options) return;
    const controller = new AbortController();
    getFinancialOptions({ signal: controller.signal }).then(result => { setOptions(result); setStore(String(result.stores[0]?.store_id ?? '')); })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, [options, reload]);
  useEffect(() => {
    if (!store) return;
    const controller = new AbortController(); let current = true;
    const filters = { mode, section: history ? 'history' : tab, page };
    if (tab === 'subscriptions' && !history) { filters.status = status; if (from) filters.from = from; if (until) filters.until = until; }
    getFinancialWorkspace(store, filters, { signal: controller.signal }).then(result => { if (current) { setData(result); setError(''); } })
      .catch(e => { if (current && e.name !== 'AbortError') { setData(null); setError(e.message); } })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [store, mode, tab, history, page, status, from, until, reload]);
  function refresh() { setData(null); setError(''); setLoading(true); setReload(n => n + 1); }
  function scopeChange(setter, value) { setData(null); setLoading(Boolean(store)); setError(''); setNotice(''); setModal(null); setDetails(null); setPage(1); setter(value); }
  function open(action, values = {}) { setDetails(null); setFormError(''); requestKey.current = null; setForm({ reason: '', ...values }); setModal(action); }
  function change(name, value) { requestKey.current = null; setForm(v => ({ ...v, [name]: value })); }
  async function save(event) {
    event.preventDefault(); if (posting.current) return;
    posting.current = true; setBusy(true); setFormError('');
    try {
      requestKey.current ??= financialKey();
      await postFinancial(store, modal, financialPayload(modal, form, mode, requestKey.current));
      setModal(null); setNotice('Financial record saved.'); refresh();
    } catch (e) { setFormError([e.message, ...Object.values(e.errors ?? {}).flat()].filter((v, i, a) => a.indexOf(v) === i).join(' ')); }
    finally { posting.current = false; setBusy(false); }
  }
  async function viewBill(id, next = 1) {
    setBusy(true); setFormError(''); setModal('details'); setDetails(null);
    try { setDetails(await getFinancialBill(store, id, mode, next)); }
    catch (e) { setFormError(e.message); }
    finally { setBusy(false); }
  }
  function editPolicy() {
    const p = data.policy;
    open('policy', { expected_version: p.version, fee_enabled: p.fee_enabled, rate_bps: p.rate_bps, cap: p.cap_centavos === null ? '' : phpInput(p.cap_centavos),
      approval_note: p.approval_note ?? '', digital_enabled: p.digital_enabled, digital_methods: p.digital_methods });
  }
  const rows = data?.records?.data ?? [], agreement = data?.agreement;
  const label = (text, name, type = 'text', props = {}) => <label className="block text-sm">{text}<input required name={name} type={type} value={form[name] ?? ''} onChange={e => change(name, e.target.value)} className={field} {...props} /></label>;
  const paymentAction = (action, payment) => open(action, { id: payment.id, expected_version: payment.version, amount: '', source_amount: payment.unallocated_centavos });
  return <div className="max-w-7xl space-y-5">
    <h1 className="text-2xl font-bold">Financial Setup</h1>
    <div className="flex flex-wrap items-end gap-4"><label className="min-w-56 text-sm">Store<select aria-label="Financial store" disabled={busy} value={store} onChange={e => scopeChange(setStore, e.target.value)} className={field}>{options?.stores.map(s => <option key={s.store_id} value={s.store_id}>{s.store_name}{s.status !== 'active' ? ' (inactive)' : ''}</option>)}</select></label>
      <label className="text-sm">Record mode<select aria-label="Financial mode" disabled={busy} value={mode} onChange={e => scopeChange(setMode, e.target.value)} className={field}><option value="actual">Actual</option><option value="test">Test</option></select></label>
      <button type="button" disabled={busy || !store} onClick={() => scopeChange(setHistory, !history)} className={secondary}>{history ? 'Back to workspace' : 'View history'}</button></div>
    {mode === 'test' && <p className="text-sm font-semibold text-amber-900">TEST records only. No Actual funds are included.</p>}
    <nav aria-label="Financial sections" className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">{[['subscriptions','Subscriptions'],['funding','Incentive Funding'],['settings','Settings']].map(([key, name]) => <button key={key} type="button" aria-current={!history && tab === key ? 'page' : undefined} disabled={busy} onClick={() => { setHistory(false); scopeChange(setTab, key); }} className={!history && tab === key ? primary : secondary}>{name}</button>)}</nav>
    {notice && <p role="status" className="text-sm text-green-800">{notice}</p>}
    {error && <p role="alert" className="text-sm text-red-800">{error} <button type="button" onClick={refresh} className={secondary}>Retry</button></p>}
    {!options && !error && <p role="status">Loading stores...</p>}{options?.stores.length === 0 && <p>Add a store before configuring financial records.</p>}
    {store && !error && !data && <p role="status">Loading financial records...</p>}
    {data && <section className="rounded-xl border border-gray-200 bg-white p-4">
      {history ? <><h2 className="mb-3 font-semibold">History ({mode})</h2><Table columns={['Date (PH)','Action','Record','Admin','Reason']} rows={rows} render={r => <tr key={r.id}>{[at(r.created_at),r.action.replaceAll('_',' '),r.entity,r.actor,r.reason].map((v,i) => <td key={i} className="max-w-xs break-words px-3 py-3">{v}</td>)}</tr>} /></> : tab === 'subscriptions' ? <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Subscription agreement</h2><p className="mt-1 text-sm">{agreement ? `${money(agreement.amount_centavos)} / ${agreement.period} | Starts ${agreement.starts_on} | ${agreement.status}` : 'No agreement for this store and mode.'}</p></div>
          <button type="button" onClick={() => open('agreement', { amount: agreement ? phpInput(agreement.amount_centavos) : '', period: agreement?.period ?? 'monthly', starts_on: agreement?.starts_on ?? options.today, status: agreement?.status ?? 'active', expected_version: agreement?.version ?? 0 })} className={secondary}>Edit agreement</button></div>
        <div className="mb-4 flex flex-wrap items-end gap-3"><label className="text-sm">Bill status<select value={status} onChange={e => scopeChange(setStatus, e.target.value)} className={field}>{['all','pending','paid','overdue','voided'].map(v => <option key={v} value={v}>{v}</option>)}</select></label>
          <label className="text-sm">Due from<input type="date" value={from} onChange={e => scopeChange(setFrom,e.target.value)} className={field} /></label><label className="text-sm">Due until<input type="date" min={from} value={until} onChange={e => scopeChange(setUntil,e.target.value)} className={field} /></label>
          <button type="button" disabled={agreement?.status !== 'active'} onClick={() => open('bill', { coverage_from: options.today, due_on: options.today, expected_version: agreement.version })} className={primary}>+ Add billing record</button></div>
        <Table columns={['Bill','Coverage','Due','Amount','Status','Actions']} rows={rows} render={r => <tr key={r.id}><td className="px-3 py-3">#{r.id}</td><td className="px-3 py-3">{r.coverage_from} to {r.coverage_until}</td><td className="px-3 py-3">{r.due_on}</td><td className="px-3 py-3">{money(r.amount_centavos)}</td><td className="px-3 py-3 capitalize">{r.status}{r.payment_id && !r.verified_at && <span className="block text-xs">Unverified entry</span>}</td><td className="px-3 py-3"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => viewBill(r.id)} className={secondary}>Payments / history</button>{r.status !== 'voided' && !r.payment_id && <><button type="button" onClick={() => open('payment', { id: r.id, amount: phpInput(r.amount_centavos), paid_on: options.today, method: 'bank_transfer', evidence: '' })} className={secondary}>Record payment</button><button type="button" onClick={() => open('void_bill', { id: r.id })} className={secondary}>Void</button></>}</div></td></tr>} />
      </> : tab === 'funding' ? <>
        <h2 className="font-semibold">Incentive Funding ({mode})</h2><dl className="my-4 flex flex-wrap gap-6">{[['Net funded',data.budget.net_funded_centavos],['Available',data.budget.available_centavos],['Reserved',data.budget.reserved_centavos]].map(([name,value]) => <div key={name}><dt className="text-sm text-gray-600">{name}</dt><dd className="font-semibold">{money(value)}</dd></div>)}</dl>
        <p className="mb-4 text-sm text-gray-600">Contribute from a verified receipt under Subscriptions. Reservations are internal; worker earnings and payouts are not connected.</p>
        <Table columns={['Movement','Date (PH)','Type','Amount','Source / link','Admin','Actions']} rows={rows} render={r => <tr key={r.id}><td className="px-3 py-3">#{r.id}</td><td className="px-3 py-3">{at(r.created_at)}</td><td className="px-3 py-3">{r.kind.replaceAll('_',' ')}</td><td className="px-3 py-3">{money(r.amount_centavos)}</td><td className="px-3 py-3">{r.payment_id ? `Receipt #${r.payment_id}` : ''}{r.related_id ? ` | Movement #${r.related_id}` : ''}<p className="mt-1 max-w-xs text-xs">{r.reason}</p></td><td className="px-3 py-3">{r.actor}</td><td className="px-3 py-3">{r.kind === 'contribution' && !r.returned_by && <button type="button" onClick={() => open('return_contribution', { id: r.id, source_amount: r.amount_centavos })} className={secondary}>Return in full</button>}</td></tr>} />
      </> : <div className="space-y-5"><p className="text-sm text-gray-600">Settings apply to this store across payment methods. Actual/Test selects records; it does not create separate shopper prices.</p>
        <section><h2 className="font-semibold">Configure Service Charge</h2><p className="mt-2 text-sm">{data.policy.fee_enabled ? `${data.policy.rate_bps / 100}% of groceries, rounded half up${data.policy.cap_centavos === null ? '' : ', capped at '+money(data.policy.cap_centavos)}` : 'OFF - no service charge.'} | Policy {data.policy.version}</p>{data.policy.approval_note && <p className="mt-1 text-sm">Reference: {data.policy.approval_note}</p>}</section>
        <section><h2 className="font-semibold">Configure Product Markup</h2><p className="mt-2 text-sm">Selling prices remain supermarket-controlled. Checkout adds no platform product markup. Editable policy is pending an agreed pricing basis.</p></section>
        <section><h2 className="font-semibold">Configure Payment Rules</h2><p className="mt-2 text-sm">Digital checkout: {data.gateway.available ? providerLabel(data.gateway.provider ?? 'paymongo')+' - '+data.gateway.channels.map(channelLabel).join(', ') : (data.gateway.reason ?? 'Unavailable')}.</p>{data.gateway.configuration_status && <p className="mt-1 text-sm">{data.gateway.configuration_status}</p>}{data.gateway.policy_warning && <p role="status" className="mt-1 text-sm text-amber-900">{data.gateway.policy_warning}</p>}{data.gateway.provider === 'xendit' && <p className="mt-1 break-all text-sm">Webhook: <code>/api/payments/xendit/test/{store}/webhook</code></p>}<p className="mt-1 text-sm">Existing accepted payment attempts keep their pinned methods and amounts.</p><Link to="/admin/cop" className="mt-2 inline-block text-sm text-green-800 underline">COP Management</Link></section>
        <button type="button" onClick={editPolicy} className={primary}>Edit service charge and payment rules</button></div>}
      {data.records && <Pages records={data.records} disabled={loading} onPage={next => scopeChange(setPage,next)} />}
    </section>}
    {modal && <Dialog key={modal} title={modal === 'details' ? `Billing record #${details?.bill.id ?? ''}` : titles[modal]} busy={busy} close={() => { setModal(null); setDetails(null); }}>
      {formError && <div className="mb-3 text-sm text-red-800"><p role="alert">{formError}</p><button type="button" disabled={busy} onClick={() => { setModal(null); refresh(); }} className={secondary}>Reload latest records</button></div>}
      {modal === 'details' ? <>{busy && <p>Loading payments...</p>}{details && <><p className="mb-4 text-sm">{details.bill.coverage_from} to {details.bill.coverage_until} | {money(details.bill.amount_centavos)} | {mode}</p>{details.void && <p className="mb-3 text-sm">Voided: {details.void.reason}</p>}{details.payments.data.length === 0 && <p className="text-sm">No payment entries.</p>}
        {details.payments.data.map(p => <article key={p.id} className="mb-3 space-y-2 border-t border-gray-200 py-3 text-sm"><h3 className="font-semibold">Receipt #{p.id} | {money(p.amount_centavos)} | {p.reversed_at ? 'Reversed' : p.verified_at ? 'Verified (Admin attestation)' : 'Unverified'}</h3><p>{p.paid_on} | {p.method.replaceAll('_',' ')} | Entered by {p.actor}</p><p className="break-words">Evidence: {p.evidence}</p>{p.verification_reason && <p>Verification: {p.verification_reason}</p>}{p.reversal_reason && <p>Reversal: {p.reversal_reason}</p>}
          {!p.reversed_at && <><p>Unallocated verified receipt: {money(p.unallocated_centavos)} (not profit)</p><div className="flex flex-wrap gap-2">{!p.verified_at ? <button type="button" onClick={() => paymentAction('verify',p)} className={primary}>Verify payment</button> : <button type="button" disabled={p.unallocated_centavos <= 0} onClick={() => paymentAction('contribute',p)} className={primary}>Contribute funds</button>}<button type="button" onClick={() => paymentAction('reverse_payment',p)} className={secondary}>Reverse payment</button></div></>}
        </article>)}<Pages records={details.payments} onPage={next => viewBill(details.bill.id,next)} disabled={busy} /></>}</> : <form onSubmit={save} className="space-y-4"><fieldset disabled={busy} className="space-y-4"><p className="text-sm font-semibold">{options?.stores.find(s => String(s.store_id) === store)?.store_name} | {modal === 'policy' ? 'Store-wide settings' : mode.toUpperCase()}</p>
        {modal === 'agreement' && <>{label('Agreed amount (PHP)','amount','text',{ inputMode:'decimal', maxLength:11 })}<label className="block text-sm">Period<select value={form.period} onChange={e => change('period',e.target.value)} className={field}><option value="monthly">Monthly</option><option value="annual">Annual</option></select></label>{label('Start date','starts_on','date')}<label className="block text-sm">Status<select value={form.status} onChange={e => change('status',e.target.value)} className={field}><option value="active">Active</option><option value="inactive">Inactive</option></select></label><p className="text-sm">Changes apply to future bills.</p></>}
        {modal === 'bill' && <>{label('Coverage starts','coverage_from','date')}{label('Due date','due_on','date')}<p className="text-sm">Full {agreement?.period} coverage and {money(agreement?.amount_centavos)} will be snapshotted from the current agreement.</p></>}
        {modal === 'payment' && <>{label('Full settlement (PHP)','amount','text',{ inputMode:'decimal', readOnly:true })}{label('Payment date','paid_on','date',{ max:options.today })}<label className="block text-sm">Method<select value={form.method} onChange={e => change('method',e.target.value)} className={field}>{['bank_transfer','cash','other'].map(v => <option key={v} value={v}>{v.replaceAll('_',' ')}</option>)}</select></label>{label('Private evidence / unique reference','evidence','text',{ minLength:3,maxLength:300 })}<p className="text-sm">Creates an unverified entry. No automatic collection occurs.</p></>}
        {modal === 'contribute' && <><p className="text-sm">Receipt #{form.id} | Unallocated: {money(form.source_amount)}</p>{label('Contribution (PHP)','amount','text',{ inputMode:'decimal',maxLength:11 })}</>}
        {modal === 'verify' && <p className="text-sm">Confirm you checked the evidence and full receipt amount. This is an Admin attestation, not provider confirmation.</p>}
        {modal === 'reverse_payment' && <p className="text-sm">Reverse receipt #{form.id} and return its unreserved supporting contributions atomically. Reserved funding may block this correction. This does not issue a bank refund.</p>}
        {modal === 'void_bill' && <p className="text-sm">Void bill #{form.id}. Its amount and history remain recorded.</p>}
        {modal === 'return_contribution' && <p className="text-sm">Return {money(form.source_amount)} from movement #{form.id} to the source receipt's unallocated amount. This does not move bank funds.</p>}
        {modal === 'policy' && <><h3 className="font-semibold">Configure Service Charge</h3><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.fee_enabled} onChange={e => change('fee_enabled',e.target.checked)} />Enable service charge</label>{label('Rate (basis points: 300 = 3%)','rate_bps','number',{ min:0,max:10000,step:1 })}{label('Maximum fee (PHP, optional)','cap','text',{ required:false,inputMode:'decimal',maxLength:11 })}{label('Store approval / reference','approval_note','text',{ required:form.fee_enabled,maxLength:500 })}<p className="text-xs text-gray-600">Technical rate range: 0-10,000 basis points. This setting and reference are not a legal-compliance certificate.</p>
          <h3 className="font-semibold">Configure Payment Rules</h3><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.digital_enabled} onChange={e => change('digital_enabled',e.target.checked)} />Allow new digital checkout when a merchant is configured</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.digital_methods === null} onChange={e => change('digital_methods',e.target.checked ? null : [])} />Use server-configured merchant methods</label>
          {form.digital_methods !== null && <fieldset className="space-y-2"><legend className="mb-2 text-sm">Allowed configured methods</legend>{data?.merchant_methods.length ? data.merchant_methods.map(method => <label key={method} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.digital_methods.includes(method)} onChange={e => change('digital_methods',e.target.checked ? [...form.digital_methods,method] : form.digital_methods.filter(m => m !== method))} />{channelLabel(method)}</label>) : <p className="text-sm">No merchant capabilities configured. Select the default above to preserve future server configuration.</p>}</fieldset>}</>}
        <label className="block text-sm">{modal === 'verify' ? 'Verification attestation / reason' : 'Reason'}<textarea required minLength={3} maxLength={500} value={form.reason} onChange={e => change('reason',e.target.value)} className={field} rows={2} /></label><button className={primary} disabled={busy}>{busy ? 'Saving...' : titles[modal]}</button>
      </fieldset></form>}
    </Dialog>}
  </div>;
}
