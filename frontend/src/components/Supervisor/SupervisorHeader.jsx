// SupervisorHeader.jsx
import { Bell, Menu, Search, ShoppingCart, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSupervisor } from './SupervisorContext'

export function SupervisorHeader({ onToggleSidebar, cartCount = 1, unreadCount = 0 }) {
  const navigate = useNavigate()
  const { supervisorPath } = useSupervisor()

  return (
    <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-6 py-3">
      <button type="button" onClick={onToggleSidebar} className="text-slate-500 md:hidden">
        <Menu size={20} />
      </button>

      <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
        <Search size={16} className="text-slate-400" />
        <input
          placeholder="Search for products, categories..."
          className="w-full text-sm outline-none placeholder:text-slate-400"
        />
      </div>

      <button type="button" className="relative text-slate-600">
        <ShoppingCart size={20} />
        {cartCount > 0 ? (
          <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
            {cartCount}
          </span>
        ) : null}
      </button>

      <button type="button" onClick={() => navigate(supervisorPath('notifications'))} className="relative text-slate-600">
        <Bell size={20} />
        {unreadCount > 0 ? (
          <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>

      <button
        type="button"
        onClick={() => navigate(supervisorPath('profile'))}
        className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
      >
        <UserRound size={16} /> Supervisor
      </button>
    </header>
  )
}
