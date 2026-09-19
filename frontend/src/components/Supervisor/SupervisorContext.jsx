// SupervisorContext.jsx
// Holds all the in-memory (no backend) Supervisor data and the actions that
// change it. Wrap your routes in <SupervisorProvider> and any page can pull
// what it needs with useSupervisor() instead of prop-drilling.

import { createContext, useContext, useMemo, useState } from 'react'
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

const SupervisorContext = createContext(null)

const nextStatus = {
  'Pending Assignment': 'Preparing',
  Preparing: 'Ready for Pickup',
  'Ready for Pickup': 'Completed',
  Completed: 'Completed',
}

export function SupervisorProvider({ children, basePath = '/supervisor', loginPath = '/login' }) {
  const [orders, setOrders] = useState(initialOrders)
  const [workers, setWorkers] = useState(initialWorkers)
  const [stockRequests, setStockRequests] = useState(initialStockRequests)
  const [payments, setPayments] = useState(initialPayments)
  const [returns, setReturns] = useState(initialReturns)
  const [notifications, setNotifications] = useState(initialNotifications)
  const [config, setConfig] = useState(systemConfigDefault)
  const [profile, setProfile] = useState(profileDefault)

  function updateOrderStatus(orderId) {
    setOrders((current) =>
      current.map((order) => (order.id === orderId ? { ...order, status: nextStatus[order.status] || order.status } : order)),
    )
  }

  function assignWorker(orderId, workerId) {
    setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, workerId } : order)))
    setWorkers((current) =>
      current.map((worker) => (worker.id === workerId ? { ...worker, availability: 'Busy', assignedOrderId: orderId } : worker)),
    )
  }

  function approveStock(requestId) {
    setStockRequests((current) => current.map((item) => (item.id === requestId ? { ...item, status: 'Approved' } : item)))
  }

  function reviewStock(requestId) {
    setStockRequests((current) => current.map((item) => (item.id === requestId ? { ...item, status: 'Needs Review' } : item)))
  }

  function verifyPayment(paymentId) {
    setPayments((current) =>
      current.map((item) =>
        item.id === paymentId
          ? { ...item, status: 'Successful', verifiedBy: `${profile.firstName?.[0] ?? 'S'}${profile.lastName?.[0] ?? '.'}` }
          : item,
      ),
    )
  }

  function updateReturnStatus(requestId, status) {
    setReturns((current) => current.map((item) => (item.id === requestId ? { ...item, status } : item)))
  }

  function saveConfig(nextConfig) {
    setConfig(nextConfig)
  }

  function saveProfile(nextProfile) {
    setProfile(nextProfile)
  }

  function markNotificationRead(id) {
    setNotifications((current) => current.map((item) => (item.id === id ? { ...item, unread: false } : item)))
  }

  function markAllNotificationsRead() {
    setNotifications((current) => current.map((item) => ({ ...item, unread: false })))
  }

  // Build an absolute path under whatever base path this is mounted at,
  // e.g. supervisorPath('orders') -> '/supervisor/orders'
  function supervisorPath(key) {
    return key ? `${basePath}/${key}` : basePath
  }

  const value = useMemo(
    () => ({
      basePath,
      loginPath,
      supervisorPath,
      orders,
      workers,
      stockRequests,
      payments,
      returns,
      notifications,
      config,
      profile,
      updateOrderStatus,
      assignWorker,
      approveStock,
      reviewStock,
      verifyPayment,
      updateReturnStatus,
      saveConfig,
      saveProfile,
      markNotificationRead,
      markAllNotificationsRead,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [basePath, loginPath, orders, workers, stockRequests, payments, returns, notifications, config, profile],
  )

  return <SupervisorContext.Provider value={value}>{children}</SupervisorContext.Provider>
}

export function useSupervisor() {
  const ctx = useContext(SupervisorContext)
  if (!ctx) {
    throw new Error('useSupervisor() must be called from inside <SupervisorProvider>')
  }
  return ctx
}
