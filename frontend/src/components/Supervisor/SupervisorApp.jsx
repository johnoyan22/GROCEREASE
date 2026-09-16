// SupervisorApp.jsx
// Entry point for the whole Supervisor frontend. Drop <SupervisorApp /> into
// your project. There is no backend here — all data lives in React state and
// resets on page reload. Swap the useState calls for real API calls later
// without touching any of the page components.

import { useState } from 'react'
import { SupervisorSidebar } from './SupervisorSidebar'
import { SupervisorHeader } from './SupervisorHeader'
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
import {
  initialNotifications,
  initialOrders,
  initialPayments,
  initialReturns,
  initialStockRequests,
  initialWorkers,
  profileDefault,
  systemConfigDefault,
} from './SupervisorData'

const nextStatus = {
  'Pending Assignment': 'Preparing',
  Preparing: 'Ready for Pickup',
  'Ready for Pickup': 'Completed',
  Completed: 'Completed',
}

export default function SupervisorApp() {
  const [page, setPage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [orders, setOrders] = useState(initialOrders)
  const [workers, setWorkers] = useState(initialWorkers)
  const [stockRequests, setStockRequests] = useState(initialStockRequests)
  const [payments, setPayments] = useState(initialPayments)
  const [returns, setReturns] = useState(initialReturns)
  const [notifications, setNotifications] = useState(initialNotifications)
  const [config, setConfig] = useState(systemConfigDefault)
  const [profile, setProfile] = useState(profileDefault)

  function handleUpdateOrderStatus(orderId) {
    setOrders((current) =>
      current.map((order) => (order.id === orderId ? { ...order, status: nextStatus[order.status] || order.status } : order)),
    )
  }

  function handleAssignWorker(orderId, workerId) {
    setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, workerId } : order)))
    setWorkers((current) => current.map((worker) => (worker.id === workerId ? { ...worker, availability: 'Busy', assignedOrderId: orderId } : worker)))
  }

  function handleApproveStock(requestId) {
    setStockRequests((current) => current.map((item) => (item.id === requestId ? { ...item, status: 'Approved' } : item)))
  }

  function handleReviewStock(requestId) {
    setStockRequests((current) => current.map((item) => (item.id === requestId ? { ...item, status: 'Needs Review' } : item)))
  }

  function handleVerifyPayment(paymentId) {
    setPayments((current) =>
      current.map((item) => (item.id === paymentId ? { ...item, status: 'Successful', verifiedBy: `${profile.firstName?.[0] ?? 'S'}${profile.lastName?.[0] ?? '.'}` } : item)),
    )
  }

  function handleViewPayment() {
    // Placeholder: wire this up to open a details view/modal for the payment.
  }

  function handleUpdateReturnStatus(requestId, status) {
    setReturns((current) => current.map((item) => (item.id === requestId ? { ...item, status } : item)))
  }

  function handleSaveConfig(nextConfig) {
    setConfig(nextConfig)
  }

  function handleSaveProfile(nextProfile) {
    setProfile(nextProfile)
  }

  function handleMarkNotificationRead(id) {
    setNotifications((current) => current.map((item) => (item.id === id ? { ...item, unread: false } : item)))
  }

  function handleMarkAllNotificationsRead() {
    setNotifications((current) => current.map((item) => ({ ...item, unread: false })))
  }

  function handleNavigate(nextPage) {
    setPage(nextPage)
    setSidebarOpen(false)
  }

  const unreadCount = notifications.filter((item) => item.unread).length

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800">
      <div className={`${sidebarOpen ? 'block' : 'hidden'} fixed inset-0 z-30 md:static md:block`}>
        <SupervisorSidebar activePage={page} onNavigate={handleNavigate} hasUnreadNotifications={unreadCount > 0} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <SupervisorHeader
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          unreadCount={unreadCount}
          onNavigate={handleNavigate}
        />

        <main className="flex-1 overflow-y-auto p-6">
          {page === 'dashboard' && (
            <SupervisorDashboard
              orders={orders}
              workers={workers}
              notifications={notifications}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onNavigate={handleNavigate}
            />
          )}
          {page === 'stock-approvals' && (
            <SupervisorStockApprovals stockRequests={stockRequests} onApproveStock={handleApproveStock} onReviewStock={handleReviewStock} />
          )}
          {page === 'orders' && (
            <SupervisorOrders orders={orders} workers={workers} onUpdateOrderStatus={handleUpdateOrderStatus} onAssignWorker={handleAssignWorker} />
          )}
          {page === 'workers' && <SupervisorWorkers workers={workers} orders={orders} onAssignWorker={handleAssignWorker} />}
          {page === 'digital-payments' && (
            <SupervisorDigitalPayments payments={payments} onVerifyPayment={handleVerifyPayment} onViewPayment={handleViewPayment} />
          )}
          {page === 'sales-reports' && <SupervisorSalesReports orders={orders} />}
          {page === 'return-refund' && <SupervisorReturnRefund returns={returns} onUpdateReturnStatus={handleUpdateReturnStatus} />}
          {page === 'system-configuration' && <SupervisorSystemConfiguration config={config} onSaveConfig={handleSaveConfig} />}
          {page === 'profile' && <SupervisorProfile profile={profile} onSaveProfile={handleSaveProfile} />}
          {page === 'notifications' && (
            <SupervisorNotifications notifications={notifications} onMarkRead={handleMarkNotificationRead} onMarkAllRead={handleMarkAllNotificationsRead} />
          )}
          {page === 'logout' && (
            <SupervisorLogout onStaySignedIn={() => handleNavigate('dashboard')} onLogout={() => handleNavigate('dashboard')} />
          )}
        </main>
      </div>
    </div>
  )
}
