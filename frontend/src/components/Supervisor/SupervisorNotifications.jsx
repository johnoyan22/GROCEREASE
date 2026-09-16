// SupervisorNotifications.jsx
import { Bell } from 'lucide-react'
import { PageHeader } from './SupervisorUI'
import { storeInfo } from './SupervisorData'

export function SupervisorNotifications({ notifications, onMarkRead, onMarkAllRead }) {
  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Stay updated on orders, payments, stock, and worker activity."
        storeName={storeInfo.name}
        storeAddress={storeInfo.address}
      />
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={onMarkAllRead} className="text-sm font-medium text-green-700">
          Mark all as read
        </button>
      </div>
      <ul className="space-y-3">
        {notifications.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onMarkRead(item.id)}
              className="flex w-full items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-green-300"
            >
              <span className="rounded-full bg-green-50 p-2 text-green-700">
                <Bell size={18} />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{item.title}</span>
                <span className="mt-1 block text-sm text-slate-500">{item.description}</span>
              </span>
              <span className="shrink-0 text-right text-xs text-slate-400">
                <span className="block">{item.date}</span>
                {item.unread ? <span className="mt-2 inline-block h-2 w-2 rounded-full bg-green-600" /> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
