import { 
  LayoutDashboard, ShoppingBag, Sparkles, Package, Store, Bell, 
  User, CreditCard, History, Settings, LogOut 
} from 'lucide-react';
import Logo from '../../assets/images/Logo.png';

function ShopperSidebar({ activeTab, setActiveTab, onLogout }) {
  const getButtonClass = (tabName) => {
    const baseClass = "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition border";
    return activeTab === tabName 
      ? `${baseClass} bg-[#006e00] text-white border-[#006e00] shadow-sm` 
      : `${baseClass} text-gray-700 hover:bg-gray-100 border-gray-200`;
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between p-4 z-10 shrink-0">
      <div>
        <div className="flex items-center gap-3 px-2 py-3 mb-6">
          <img src={Logo} alt="GrocerEase Logo" className="w-10 h-10 object-contain" />
          <span className="text-2xl font-black text-black tracking-tight">
            Grocer<span className="text-[#006e00]">Ease</span>
          </span>
        </div>

        <nav className="space-y-1.5">
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

          <button
            onClick={() => setActiveTab('AI')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition border ${
              activeTab === 'AI' 
                ? 'bg-[#006e00] text-white border-[#006e00]' 
                : 'text-gray-700 hover:bg-gray-100 border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <Sparkles className={`w-4 h-4 ${activeTab === 'AI' ? 'text-white' : 'text-emerald-600'}`} />
              AI Recommendations
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
              activeTab === 'AI' ? 'bg-white text-[#006e00]' : 'bg-emerald-100 text-[#006e00]'
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
                ? 'bg-[#006e00] text-white border-[#006e00]' 
                : 'text-gray-700 hover:bg-gray-100 border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <Store className="w-4 h-4" />
              Pick up Information
            </div>
            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
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
          Settings
        </button>

        <button
          onClick={onLogout}
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