import Avatar from '../shared/Avatar';
import {
  LayoutDashboard, ShoppingBag, Sparkles, Package, Store, Bell,
  User, CreditCard, History, Settings, LogOut, ShoppingCart
} from 'lucide-react';
import Logo from '../../assets/images/Logo.png';
import { logout } from '../../services/api';
import { useNavigate } from 'react-router-dom';

function ShopperSidebar({ activeTab, setActiveTab, user }) {
  const navigate = useNavigate();

  const getButtonClass = (tabName) => {
    const baseClass = "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition border";
    return activeTab === tabName
      ? `${baseClass} bg-primary text-white border-primary shadow-sm`
      : `${baseClass} text-gray-700 hover:bg-gray-100 border-gray-200`;
  };

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
    <aside className="w-full lg:w-64 min-h-full bg-white border-r border-gray-200 flex flex-col justify-between p-4 z-10 shrink-0">
      <div>
        <div className="flex items-center gap-3 px-2 py-3 mb-6">
          <img src={Logo} alt="GrocerEase Logo" className="w-10 h-10 object-contain" />
          <span className="text-2xl font-black text-black tracking-tight">
            Grocer<span className="text-primary">Ease</span>
          </span>
        </div>

        <div className="mb-5 flex items-center gap-3 rounded-xl bg-green-50 p-3"><Avatar profile={user?.profile} imageUrl={user?.profile?.image_url} className="h-9 w-9" /><div className="min-w-0"><p className="truncate text-sm font-semibold">{[user?.profile?.first_name, user?.profile?.last_name].filter(Boolean).join(" ") || "Shopper"}</p><p className="text-xs text-slate-600">Shopper account</p></div></div><nav aria-label="Shopper navigation" className="space-y-1.5">
          <button
            onClick={() => setActiveTab('Dashboard')}
            className={getButtonClass('Dashboard')}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>

          <button
            onClick={() => setActiveTab('Browse')}
            className={getButtonClass('Browse')}
          >
            <ShoppingBag className="w-4 h-4" />
            Browse Products
          </button>

          <button type="button" onClick={() => setActiveTab('Cart')} className={getButtonClass('Cart')}>
            <ShoppingCart className="w-4 h-4" />My Cart
          </button>

          <button
            onClick={() => setActiveTab('AI')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition border ${
              activeTab === 'AI'
                ? 'bg-primary text-white border-primary'
                : 'text-gray-700 hover:bg-gray-100 border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <Sparkles className={`w-4 h-4 ${activeTab === 'AI' ? 'text-white' : 'text-emerald-600'}`} />
              AI Recommendations
            </div>
            <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${
              activeTab === 'AI' ? 'bg-white text-primary' : 'bg-emerald-100 text-primary'
            }`}>
              ✨ AI
            </span>
          </button>

          <button
            onClick={() => setActiveTab('Orders')}
            className={getButtonClass('Orders')}
          >
            <Package className="w-4 h-4" />
            My Orders
          </button>

          <button
            onClick={() => setActiveTab('Pickup')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition border ${
              activeTab === 'Pickup'
                ? 'bg-primary text-white border-primary'
                : 'text-gray-700 hover:bg-gray-100 border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <Store className="w-4 h-4" />
              Pick up Information
            </div>
          </button>

          <button
            onClick={() => setActiveTab('Notifications')}
            className={getButtonClass('Notifications')}
          >
            <Bell className="w-4 h-4" />
            Notifications
          </button>
        </nav>
      </div>

      <div className="space-y-1.5 pt-4 border-t border-gray-100">
        <button
          onClick={() => setActiveTab('Profile')}
          className={getButtonClass('Profile')}
        >
          <User className="w-4 h-4" />
          My Profile
        </button>

        <button
          onClick={() => setActiveTab('Payment')}
          className={getButtonClass('Payment')}
        >
          <CreditCard className="w-4 h-4" />
          Payment Methods
        </button>

        <button
          onClick={() => setActiveTab('History')}
          className={getButtonClass('History')}
        >
          <History className="w-4 h-4" />
          History
        </button>

        <button
          onClick={() => setActiveTab('Settings')}
          className={getButtonClass('Settings')}
        >
          <Settings className="w-4 h-4" />
          Account &amp; Security
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 mt-2 transition"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}

export default ShopperSidebar;
