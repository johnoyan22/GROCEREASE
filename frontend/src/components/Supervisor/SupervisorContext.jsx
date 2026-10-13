// SupervisorContext.jsx
// Holds all the in-memory (no backend) Supervisor data and the actions that
// change it. Wrap your routes in <SupervisorProvider> and any page can pull
// what it needs with useSupervisor() instead of prop-drilling.

import { createContext, useContext, useMemo, useEffect, useState } from 'react'
import {
  initialNotifications,
  initialOrders,
  initialPayments,
  initialReturns,
  initialStockRequests,
  initialWorkers,
  systemConfigDefault,
} from './SupervisorData'

import { useNavigate } from 'react-router-dom'
import { getCurrentUser } from '../../services/api'

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

  const [profile, setProfile] = useState(null)
  const [isAccountLoading, setIsAccountLoading] = useState(true)
  const [accountError, setAccountError] = useState('')
  const [accountLoadVersion, setAccountLoadVersion] = useState(0)

  const navigate = useNavigate()

  useEffect(() => {
    let active = true

    getCurrentUser()
      .then((currentUser) => {
        if (!active) {
          return
        }

        if (!currentUser.role || currentUser.role.slug !== 'supervisor') {
          navigate('/', { replace: true })
          return
        }

        if (!currentUser.profile) {
          setAccountError(
            'Your staff profile could not be found. Please contact your administrator.'
          )
          return
        }

        const accountProfile = currentUser.profile

        setProfile({
          role: currentUser.role.name,
          firstName: accountProfile.first_name,
          lastName: accountProfile.last_name,
          email: currentUser.email,
          phone: accountProfile.phone_number,
        })

        setAccountError('')
      }).catch((error) => {
        if (!active) {
          return
        }

        if (error.status === 401) {
          navigate(loginPath, { replace: true })
          return
        }

        setAccountError('Could not load your account. Please try again.')
      }).finally(() => {
        if (active) {
          setIsAccountLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [navigate, loginPath, accountLoadVersion])

  function retryAccountLoading() {
    setAccountError('')
    setIsAccountLoading(true)
    setAccountLoadVersion((version) => version + 1)
  }

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
      markNotificationRead,
      markAllNotificationsRead,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [basePath, loginPath, orders, workers, stockRequests, payments, returns, notifications, config, profile],
  )

  if (isAccountLoading) {
    return (
      <p role="status" className="p-6 text-sm text-slate-600">Loading your supervisor account...</p>
    )
  }

  if (accountError) {
    return (
      <div className="p-6">
        <p role="alert" className="text-sm text-red-700">
          {accountError}
        </p>

        <button
          type="button"
          onClick={retryAccountLoading}
          className="mt-3 rounded-xl bg-green-700 px-4 py-2 text-sm text-white"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!profile) {
    return null
  }

  return (
    <SupervisorContext.Provider value={value}>
      {children}
    </SupervisorContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- Provider and context hook are intentionally kept together.
export function useSupervisor() {
  const ctx = useContext(SupervisorContext)
  if (!ctx) {
    throw new Error('useSupervisor() must be called from inside <SupervisorProvider>')
  }
  return ctx
}
