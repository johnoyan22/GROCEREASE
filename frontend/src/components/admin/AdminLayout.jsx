import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  KeyRound, 
  Package, 
  CircleDollarSign, 
  Ban, 
  FileBarChart2, 
  Settings as SettingsIcon, 
  LogOut, 
  Search, 
  Bell, 
  Menu,
  ChevronDown
} from 'lucide-react';

const navItems = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/roles', label: 'Role Management', icon: KeyRound },
  { path: '/admin/stock', label: 'Stock Management', icon: Package },
  { path: '/admin/financial', label: 'Financial Setup', icon: CircleDollarSign },
  { path: '/admin/cop', label: 'COP Management', icon: Ban },
  { path: '/admin/reports', label: 'Report Module', icon: FileBarChart2 },
];

export default function AdminLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-slate-800 antialiased font-sans">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 fixed inset-y-0 left-0 z-30">
        <div>
          <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Package size={22} className="text-emerald-700" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">
                Grocer <span className="text-emerald-600">Ease</span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">Grocery System</p>
            </div>
          </div>

          <nav className="p-4 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-[#0E5C2F] text-white shadow-sm font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={18} className={isActive ? 'text-white' : 'text-slate-500'} />
                      {item.label}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-100 space-y-1">
          <NavLink
            to="/admin/settings"
            className={({ isActive }) =>
              `w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#0E5C2F] text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <SettingsIcon size={18} className={isActive ? 'text-white' : 'text-slate-500'} />
                Settings
              </>
            )}
          </NavLink>
          <button
            onClick={() => alert('Logging out...')}
            className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-all"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <div className="pl-64 flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <button className="text-slate-500 hover:text-slate-700">
              <Menu size={20} />
            </button>
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                type="text"
                placeholder="Search for users, products, orders, reports..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-5">
            <button className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-xl transition-all">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                6
              </span>
            </button>

            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                alt="Admin"
                className="w-9 h-9 rounded-full object-cover border border-slate-200"
              />
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-slate-800 leading-tight">Admin</p>
                <p className="text-[11px] text-slate-400">Administrator</p>
              </div>
              <ChevronDown size={14} className="text-slate-400 ml-1" />
            </div>
          </div>
        </header>

        <main className="flex-1 p-8">
          {children}
        </main>

        <footer className="px-8 py-4 border-t border-slate-200 bg-white flex justify-between items-center text-xs text-slate-400">
          <p>© 2025 GrocerEase Grocery System. All rights reserved.</p>
          <p>Version 1.0.0</p>
        </footer>
      </div>
    </div>
  );
}