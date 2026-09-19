// SupervisorLogout.jsx
import { useNavigate } from 'react-router-dom'
import { PageHeader } from './SupervisorUI'
import { storeInfo } from './SupervisorData'
import { useSupervisor } from './SupervisorContext'

export function SupervisorLogout() {
  const navigate = useNavigate()
  const { loginPath } = useSupervisor()

  return (
    <div>
      <PageHeader
        title="Logout"
        subtitle="End this supervisor session. You can sign back in from the login screen."
        storeName={storeInfo.name}
        storeAddress={storeInfo.address}
      />
      <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-slate-600">Are you sure you want to log out of GrocerEase Supervisor?</p>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={() => navigate(-1)} className="rounded-xl border border-slate-200 px-5 py-2">
            Stay signed in
          </button>
          <button type="button" onClick={() => navigate(loginPath)} className="rounded-xl bg-red-600 px-5 py-2 text-white">
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}
