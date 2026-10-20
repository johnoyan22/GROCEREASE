import { useEffect, useRef, useState } from 'react';
import { getAdminAccounts, updateAccountStatus } from '../../services/api';

export default function AccountManagement() {
  const [state, setState] = useState({ accounts: [], loading: true, error: '' });
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const busy = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    getAdminAccounts({ signal: controller.signal }).then(result => {
      if (active) setState({ accounts: result.accounts, loading: false, error: '' });
    }).catch(error => { if (active && error.name !== 'AbortError') setState({ accounts: [], loading: false, error: error.message }); });
    return () => { active = false; controller.abort(); };
  }, [version]);
  function refresh() { setState({ accounts: [], loading: true, error: '' }); setVersion(v => v + 1); }
  async function save(event) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true; setPending(true); setNotice('');
    try {
      const result = await updateAccountStatus(selected.id, selected.account_status === 'active' ? 'inactive' : 'active', reason.trim());
      setNotice(result.message); setSelected(null); setReason(''); refresh();
    } catch (error) { setNotice(Object.values(error.errors ?? {}).flat().join(' ') || error.message); }
    finally { busy.current = false; setPending(false); }
  }
  const accounts = state.accounts.filter(row => [row.email, row.role, row.account_status].join(' ').toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-5"><h1 className="text-2xl font-bold">User Accounts</h1><p className="text-sm text-gray-600">Activation controls sign-in and authenticated access. Supermarket status, staff approval, store placement and COP restrictions are managed separately.</p><div className="flex gap-3"><input type="search" aria-label="Search accounts" placeholder="Search email, role or status" value={search} onChange={event => setSearch(event.target.value)} className="flex-1 rounded-lg border border-gray-300 p-2 text-sm" /><button type="button" onClick={refresh} disabled={state.loading} className="rounded-lg border border-green-700 px-4 py-2 text-sm text-green-800">Refresh</button></div>{state.loading && <p role="status">Loading accounts...</p>}{state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}{notice && <p role="status" className="rounded-lg border bg-white p-3 text-sm">{notice}</p>}{selected && <form onSubmit={save} className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm"><p className="font-semibold">{selected.account_status === 'active' ? 'Deactivate' : 'Activate'} {selected.email}</p><p className="mt-2">Deactivation prevents further access and revokes existing tokens and database sessions.</p><label className="mt-3 block">Reason<textarea required maxLength="500" value={reason} onChange={event => setReason(event.target.value)} disabled={pending} className="mt-1 w-full rounded-lg border p-2" /></label><div className="mt-3 flex gap-3"><button disabled={pending || !reason.trim()} className="rounded-lg bg-green-700 px-4 py-2 text-white">Confirm account status</button><button type="button" disabled={pending} onClick={() => setSelected(null)} className="rounded-lg border px-4 py-2">Cancel</button></div></form>}<div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Account</th><th>Role</th><th>Account status</th><th>Action</th></tr></thead><tbody>{accounts.map(row => <tr key={row.id} className="border-b border-gray-100"><td className="p-3">{row.email}</td><td>{row.role}</td><td>{row.account_status}</td><td><button type="button" disabled={pending} onClick={() => { setSelected(row); setReason(''); setNotice(''); }} className="text-green-800 underline">{row.account_status === 'active' ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table>{!state.loading && !state.error && accounts.length === 0 && <p className="p-4 text-sm text-gray-500">No matching accounts.</p>}</div></div>;
}
