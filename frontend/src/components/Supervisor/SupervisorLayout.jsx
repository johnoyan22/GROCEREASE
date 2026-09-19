// SupervisorLayout.jsx
// Sidebar + header shell, rendered once by the router. The matched child
// route (Dashboard, Orders, etc.) renders into <Outlet />.

import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { SupervisorSidebar } from './SupervisorSidebar'
import { SupervisorHeader } from './SupervisorHeader'
import { useSupervisor } from './SupervisorContext'

export function SupervisorLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { notifications } = useSupervisor()
  const unreadCount = notifications.filter((item) => item.unread).length

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800">
      <div className={`${sidebarOpen ? 'block' : 'hidden'} fixed inset-0 z-30 md:static md:block`}>
        <SupervisorSidebar hasUnreadNotifications={unreadCount > 0} onNavigateMobile={() => setSidebarOpen(false)} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <SupervisorHeader onToggleSidebar={() => setSidebarOpen((open) => !open)} unreadCount={unreadCount} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
