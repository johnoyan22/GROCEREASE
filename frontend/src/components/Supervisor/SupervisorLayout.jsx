import NavigationDrawer from '../shared/NavigationDrawer';
// SupervisorLayout.jsx
// Sidebar + header shell, rendered once by the router. The matched child
// route (Dashboard, Orders, etc.) renders into <Outlet />.

import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { SupervisorSidebar } from './SupervisorSidebar'
import { SupervisorHeader } from './SupervisorHeader'

export function SupervisorLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const unreadCount = 0 // Staff unread-message tracking is not configured.

  return (
    <div className="flex h-dvh bg-slate-50 text-slate-800">
      <div className="hidden h-full overflow-y-auto lg:block">
        <SupervisorSidebar hasUnreadNotifications={unreadCount > 0} onNavigateMobile={() => setSidebarOpen(false)} />
      </div>

      {sidebarOpen && <NavigationDrawer onClose={() => setSidebarOpen(false)}><SupervisorSidebar onNavigateMobile={() => setSidebarOpen(false)} /></NavigationDrawer>}
      <div className="flex min-w-0 flex-1 flex-col">
        <SupervisorHeader onToggleSidebar={() => setSidebarOpen((open) => !open)} unreadCount={unreadCount} />
        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
