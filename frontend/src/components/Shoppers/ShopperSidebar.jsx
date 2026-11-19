import { LayoutDashboard, ShoppingBag, Sparkles, Package, Store, Bell, User, CreditCard, History, Settings, LogOut, ShoppingCart, X } from 'lucide-react';
import Logo from '../../assets/images/Logo.png';
import { logout } from '../../services/api';
import { useNavigate } from 'react-router-dom';

const shoppingLinks = [['Dashboard', 'Dashboard', LayoutDashboard], ['Browse', 'Browse Products', ShoppingBag], ['Cart', 'My Cart', ShoppingCart], ['AI', 'AI Recommendations', Sparkles], ['Orders', 'My Orders', Package], ['Pickup', 'Pick up Information', Store], ['Notifications', 'Notifications', Bell]];
const accountLinks = [['Profile', 'My Profile', User], ['Payment', 'Payment Methods', CreditCard], ['History', 'History', History], ['Settings', 'Settings', Settings]];

export default function ShopperSidebar({ activeTab, setActiveTab, mobile = false, onClose }) {
  const navigate = useNavigate();
  async function handleLogout() {
    try { await logout(); navigate('/login', { replace: true }); }
    catch (error) { console.error('Could not log out:', error); alert('Logout failed. Please try again'); }
  }
  function links(items) {
    return items.map(([tab, name, Icon]) => <button key={tab} type="button" aria-current={activeTab === tab ? 'page' : undefined} onClick={() => setActiveTab(tab)} className={'flex min-h-11 w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left text-sm font-semibold transition ' + (activeTab === tab ? 'border-[#006e00] bg-[#006e00] text-white shadow-sm' : 'border-gray-200 text-gray-700 hover:bg-gray-100')}><Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{name}</button>);
  }
  return <aside className={mobile ? 'flex min-h-full min-w-0 flex-col gap-6 bg-white p-4' : 'sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r border-gray-200 bg-white p-4 lg:flex xl:w-64'}>
    <div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2 py-2"><img src={Logo} alt="" className="h-10 w-10 shrink-0 object-contain" /><span id={mobile ? 'shopper-menu-title' : undefined} className="text-2xl font-black tracking-tight text-black">Grocer<span className="text-[#006e00]">Ease</span></span></div>{mobile && <button type="button" aria-label="Close Shopper menu" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200"><X className="h-5 w-5" /></button>}</div>
    <nav aria-label="Shopper navigation" className="space-y-1.5">{links(shoppingLinks)}</nav>
    <nav aria-label="Shopper account" className="mt-auto space-y-1.5 border-t border-gray-100 pt-4">{links(accountLinks)}<button type="button" onClick={handleLogout} className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-lg border border-red-200 px-3.5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />Logout</button></nav>
  </aside>;
}
