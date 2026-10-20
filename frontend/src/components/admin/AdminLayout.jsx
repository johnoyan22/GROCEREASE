import {
  NavLink,
  useNavigate,
  useOutletContext
} from 'react-router-dom';

import {
  LayoutDashboard,
  KeyRound,
  Package,
  CircleDollarSign,
  Ban,
  FileBarChart2,
  LogOut,
  UserRound,
  UsersRound,
  Store
} from 'lucide-react';
import { logout } from '../../services/api';

const navItems = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/accounts', label: 'User Accounts', icon: UsersRound },
  { path: '/admin/stores', label: 'Store Management', icon: Store },
  { path: '/admin/staff', label: 'Staff Management', icon: UsersRound },
  { path: '/admin/roles', label: 'Role Management', icon: KeyRound },
  { path: '/admin/financial', label: 'Financial Setup', icon: CircleDollarSign },
  { path: '/admin/cop', label: 'COP Management', icon: Ban },
  { path: '/admin/transactions', label: 'Transactions', icon: CircleDollarSign },
  { path: '/admin/reports', label: 'Report Module', icon: FileBarChart2 },
];

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
    const { user } = useOutletContext();

  let fullName = 'Admin';

  if (user.profile) {
    const firstName = user.profile.first_name || '';
    const lastName = user.profile.last_name || '';

    const accountName = (firstName + ' ' + lastName).trim();

    if (accountName !== '') {
      fullName = accountName;
    }
  }

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true});
    } catch (error) {
      console.error('Could not log out:', error);
      alert('Logout failed. Please try again');
    }
  };

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
            className={function (linkState) {
              if (linkState.isActive) {
                return "flex w-full items-center gap-3.5 rounded-xl bg-[#0E5C2F] px-4 py-2.5 text-sm font-semibold text-white";
              }

              return "flex w-full items-center gap-3.5 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50";
            }}
          >
            <UserRound size={18} />
            <span>Profile</span>
          </NavLink>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-all"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <div className="pl-64 flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-20">
                      <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
              <div
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-400"
              >
                <UserRound size={20} />
              </div>

              <div className="hidden text-left sm:block">
                <p className="max-w-40 truncate text-xs font-bold leading-tight text-slate-800">
                  {fullName}
                </p>

                <p className="text-[11px] text-slate-400">
                  {user.role.name}
                </p>
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
