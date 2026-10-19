import { useEffect, useRef, useState } from 'react';
import { correctCopStrike, getCopStrikes } from '../../services/api';

function Correction({ strike, onSaved }) {
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  async function correct(event) {
    event.preventDefault();
    if (busy.current || !window.confirm('Void this erroneous strike? The original record and your correction reason will remain in the audit history.')) return;
    busy.current = true; setPending(true); setError('');
    try { const result = await correctCopStrike(strike.id, reason.trim()); onSaved(result.message); }
    catch (failure) { setError(Object.values(failure.errors ?? {}).flat().join(' ') || failure.message); }
    finally { busy.current = false; setPending(false); }
  }
  if (strike.voided_at) return <p className="text-xs text-gray-600">Corrected by User #{strike.voided_by_user_id}: {strike.correction_reason}</p>;
  return <form onSubmit={correct} className="space-y-2"><label className="block text-xs">Correction reason<input required maxLength="500" disabled={pending} value={reason} onChange={function (event) { setReason(event.target.value); }} className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm" /></label><button disabled={pending} className="rounded-lg border border-amber-500 px-3 py-2 text-xs text-amber-900">Correct erroneous strike</button>{error && <p role="alert" className="text-xs text-red-700">{error}</p>}</form>;
}

export default function CopManagement() {
  const [rows, setRows] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(function () {
    const controller = new AbortController();
    let active = true;
    getCopStrikes({ signal: controller.signal }).then(function (result) { if (active) { setRows(result.strikes); setAccounts(result.accounts); setLoading(false); } })
      .catch(function (failure) { if (active && failure.name !== 'AbortError') { setError(failure.message); setLoading(false); } });
    return function () { active = false; controller.abort(); };
  }, [version]);
  function reload(message = '') { setRows([]); setAccounts([]); setLoading(true); setError(''); setNotice(message); setVersion(function (value) { return value + 1; }); }
  return <div className="space-y-5"><h1 className="text-2xl font-bold">Cash on Pickup monitoring</h1><p className="text-sm text-gray-600">Maximum COP total: ₱1,500. First No-Show: warning. Second: 30-day COP restriction. Third: permanent COP restriction. The Shopper account remains active. Paid unclaimed orders do not receive COP strikes.</p><button type="button" onClick={function () { reload(); }} className="rounded-lg border border-green-700 px-4 py-2 text-sm text-green-800">Refresh records</button>{notice && <p role="status" className="text-sm text-green-800">{notice}</p>}{loading && <p role="status">Loading actual COP records...</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}{!loading && !error && accounts.length > 0 && <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">{accounts.map(function (account) { return <p key={account.user_id} className="text-sm">{account.email} · {account.cop.strike_count} active strikes · {account.cop.allowed ? 'COP available' : account.cop.permanently_disabled ? 'COP permanently disabled' : 'COP disabled until '+new Date(account.cop.disabled_until).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>; })}</div>}{!loading && !error && <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-4"><table className="w-full min-w-[750px] text-left text-sm"><thead><tr className="border-b border-gray-200"><th scope="col" className="py-3">Shopper</th><th scope="col">Store / order</th><th scope="col">Strike at issue</th><th scope="col">Recorded at (UTC)</th><th scope="col" className="w-64">Audit correction</th></tr></thead><tbody>{rows.map(function (strike) { return <tr key={strike.id} className="border-b border-gray-100"><td className="py-4 pr-3">{strike.email}<p className="text-xs text-gray-500">User #{strike.shopper_user_id}</p></td><td className="pr-3">{strike.store_name}<p>Order #{strike.order_id}</p></td><td>{strike.strike_number_at_issue} · {strike.voided_at ? 'Corrected' : 'Active record'}</td><td>{strike.issued_at}</td><td className="py-4"><Correction strike={strike} onSaved={reload} /></td></tr>; })}{rows.length === 0 && <tr><td colSpan="5" className="py-8 text-center text-gray-500">No COP strikes have been recorded.</td></tr>}</tbody></table></div>}</div>;
}
