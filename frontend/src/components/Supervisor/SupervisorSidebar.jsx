// SupervisorSidebar.jsx
import { NavLink } from 'react-router-dom'
import {
  Bell,
  ClipboardList,
  CreditCard,
  Gauge,
  LayoutGrid,
  LogOut,
  RotateCcw,
  Settings,
  ShoppingCart,
  User,
  Users,
} from 'lucide-react'
import { useSupervisor } from './SupervisorContext'

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { key: 'stock-approvals', label: 'Stock Approvals', icon: ClipboardList },
  { key: 'orders', label: 'Orders', hint: 'Active & History', icon: ShoppingCart },
  { key: 'workers', label: 'Workers', hint: 'Assignment & Performance', icon: Users },
  { key: 'digital-payments', label: 'Digital Payments', icon: CreditCard },
  { key: 'sales-reports', label: 'Sales Reports', icon: Gauge },
  { key: 'return-refund', label: 'Return & Refund', icon: RotateCcw },
  { key: 'system-configuration', label: 'System Configuration', icon: Settings },
]

function navClass({ isActive }) {
  return `flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${
    isActive ? 'bg-green-700 text-white' : 'text-slate-600 hover:bg-slate-50'
  }`
}

export function SupervisorSidebar({ hasUnreadNotifications, onNavigateMobile }) {
  const { supervisorPath } = useSupervisor()

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col justify-between border-r border-slate-200 bg-white px-3 py-4">
      <div>
        <div className="mb-6 flex items-center gap-2 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-700 text-white">
            <ShoppingCart size={16} />
          </span>
          <span className="font-serif text-lg">
            Grocer<span className="text-green-700">Ease</span>
          </span>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink key={item.key} to={supervisorPath(item.key)} onClick={onNavigateMobile} className={navClass}>
                {({ isActive }) => (
                  <>
                    <Icon size={16} />
                    <span>
                      <span className="block leading-tight">{item.label}</span>
                      {item.hint ? (
                        <span className={`block text-[11px] leading-tight ${isActive ? 'text-green-100' : 'text-slate-400'}`}>
                          {item.hint}
                        </span>
                      ) : null}
                    </span>
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>
      </div>

      <div className="space-y-1 border-t border-slate-100 pt-3">
        <NavLink to={supervisorPath('profile')} onClick={onNavigateMobile} className={navClass}>
          <User size={16} /> Profile
        </NavLink>
        <NavLink to={supervisorPath('notifications')} onClick={onNavigateMobile} className={navClass}>
          <Bell size={16} />
          Notification
          {hasUnreadNotifications ? <span className="ml-1 h-2 w-2 rounded-full bg-red-500" /> : null}
        </NavLink>
        <NavLink
          to={supervisorPath('logout')}
          onClick={onNavigateMobile}
          className={({ isActive }) =>
            `flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${
              isActive ? 'bg-red-600 text-white' : 'text-red-600 hover:bg-red-50'
            }`
          }
        >
          <LogOut size={16} /> Logout
        </NavLink>
      </div>
    </aside>
  )
}
