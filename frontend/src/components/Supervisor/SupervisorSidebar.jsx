// SupervisorSidebar.jsx
import {
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
  Bell,
} from 'lucide-react'

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

export function SupervisorSidebar({ activePage, onNavigate, hasUnreadNotifications }) {
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
            const active = activePage === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.key)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${
                  active ? 'bg-green-700 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon size={16} />
                <span>
                  <span className="block leading-tight">{item.label}</span>
                  {item.hint ? (
                    <span className={`block text-[11px] leading-tight ${active ? 'text-green-100' : 'text-slate-400'}`}>
                      {item.hint}
                    </span>
                  ) : null}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      <div className="space-y-1 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => onNavigate('profile')}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
        >
          <User size={16} /> Profile
        </button>
        <button
          type="button"
          onClick={() => onNavigate('notifications')}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
        >
          <Bell size={16} />
          Notification
          {hasUnreadNotifications ? <span className="ml-1 h-2 w-2 rounded-full bg-red-500" /> : null}
        </button>
        <button
          type="button"
          onClick={() => onNavigate('logout')}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
        >
          <LogOut size={16} /> Logout
        </button>
      </div>
    </aside>
  )
}
