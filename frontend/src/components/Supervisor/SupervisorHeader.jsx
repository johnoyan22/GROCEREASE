import { Bell, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSupervisor } from './SupervisorContext';
import Avatar from '../shared/Avatar';
export function SupervisorHeader({ onToggleSidebar, unreadCount = 0 }) {
  const navigate = useNavigate();
  const { profile, supervisorPath } = useSupervisor();
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Supervisor';
  return <header className="flex min-w-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
    <button type="button" aria-label="Open navigation menu" onClick={onToggleSidebar} className="p-2 md:hidden"><Menu size={20} /></button>
    <p className="flex-1 font-semibold text-green-900">Store workspace</p>
    <button type="button" aria-label="View notifications" onClick={() => navigate(supervisorPath('notifications'))} className="relative p-2 text-slate-600"><Bell size={20} />{unreadCount > 0 && <span className="absolute right-0 top-0 rounded-full bg-green-800 px-1 text-xs text-white">{unreadCount}</span>}</button>
    <button type="button" aria-label="Open your account" onClick={() => navigate(supervisorPath('profile'))} className="flex min-w-0 items-center gap-2 rounded-xl p-1 text-sm"><Avatar profile={profile} /><span className="hidden max-w-48 truncate sm:inline">{fullName}</span></button>
  </header>;
}
