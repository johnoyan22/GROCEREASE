// SupervisorApp.jsx
// Nested route bundle for the whole Supervisor section. Mount it inside your
// existing router like this (inside your <Routes>, wherever it lives):
//
//   import SupervisorApp from './components/Supervisor/SupervisorApp'
//   ...
//   <Route path="/supervisor/*" element={<SupervisorApp />} />
//
// If you mount it at a path other than "/supervisor", pass that path in:
//   <Route path="/staff/*" element={<SupervisorApp basePath="/staff" />} />
//
// "loginPath" is where the Logout button sends the user — point it at
// whatever route your app's real login page lives on.

import { Navigate, Route, Routes } from 'react-router-dom'
import { SupervisorProvider } from './SupervisorContext'
import { SupervisorLayout } from './SupervisorLayout'
import { SupervisorDashboard } from './SupervisorDashboard'
import { SupervisorStockApprovals } from './SupervisorStockApprovals'
import { SupervisorOrders } from './SupervisorOrders'
import { SupervisorWorkers } from './SupervisorWorkers'
import { SupervisorDigitalPayments } from './SupervisorDigitalPayments'
import { SupervisorSalesReports } from './SupervisorSalesReports'
import { SupervisorReturnRefund } from './SupervisorReturnRefund'
import { SupervisorSystemConfiguration } from './SupervisorSystemConfiguration'
import { SupervisorProfile } from './SupervisorProfile'
import { SupervisorNotifications } from './SupervisorNotifications'
import { SupervisorLogout } from './SupervisorLogout'

export default function SupervisorApp({ basePath = '/supervisor', loginPath = '/login' }) {
  return (
    <SupervisorProvider basePath={basePath} loginPath={loginPath}>
      <Routes>
        <Route element={<SupervisorLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<SupervisorDashboard />} />
          <Route path="stock-approvals" element={<SupervisorStockApprovals />} />
          <Route path="orders" element={<SupervisorOrders />} />
          <Route path="workers" element={<SupervisorWorkers />} />
          <Route path="digital-payments" element={<SupervisorDigitalPayments />} />
          <Route path="sales-reports" element={<SupervisorSalesReports />} />
          <Route path="return-refund" element={<SupervisorReturnRefund />} />
          <Route path="system-configuration" element={<SupervisorSystemConfiguration />} />
          <Route path="profile" element={<SupervisorProfile />} />
          <Route path="notifications" element={<SupervisorNotifications />} />
          <Route path="logout" element={<SupervisorLogout />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>
      </Routes>
    </SupervisorProvider>
  )
}
