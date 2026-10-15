
import { Bell, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from './SupervisorUI'
import { storeInfo } from './SupervisorData'
import { useSupervisor } from './SupervisorContext'

export function SupervisorNotifications() {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
  } = useSupervisor()

  const [deletedIds, setDeletedIds] = useState([])

  const visibleNotifications = notifications.filter(
    (item) => !deletedIds.includes(item.id)
  )

  const deleteNotification = (id) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this notification?'
    )

    if (!confirmed) return

    setDeletedIds((previous) => [...previous, id])
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Stay updated on orders, payments, stock, and worker activity."
        storeName={storeInfo.name}
        storeAddress={storeInfo.address}
      />

      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={markAllNotificationsRead}
          className="text-sm font-medium text-green-700"
        >
          Mark all as read
        </button>
      </div>

      <ul className="space-y-3">
        {visibleNotifications.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-green-300"
          >
            {/* Notification content */}
            <button
              type="button"
              onClick={() => markNotificationRead(item.id)}
              className="flex min-w-0 flex-1 items-start gap-4 text-left"
            >
              <span className="rounded-full bg-green-50 p-2 text-green-700">
                <Bell size={18} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {item.title}
                </span>

                <span className="mt-1 block text-sm text-slate-500">
                  {item.description}
                </span>
              </span>
            </button>

            {/* Date and unread indicator */}
            <div className="shrink-0 text-right text-xs text-slate-400">
              <span className="block">{item.date}</span>

              {item.unread && (
                <span className="mt-2 inline-block h-2 w-2 rounded-full bg-green-600" />
              )}
            </div>

            {/* Delete button - far right */}
            <button
              type="button"
              onClick={() => deleteNotification(item.id)}
              title="Delete notification"
              aria-label={`Delete ${item.title}`}
              className="shrink-0 rounded-lg p-2 text-red-500 transition hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 size={19} />
            </button>
          </li>
        ))}
      </ul>

      {visibleNotifications.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          No notifications available.
        </div>
      )}
    </div>
  )
}
