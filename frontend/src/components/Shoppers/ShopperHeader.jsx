import { useState } from 'react';
import { Search, ShoppingCart, Bell, User, ChevronDown } from 'lucide-react';

function ShopperHeader({ user, quantity = 0, unreadCount, onCart, onNotifications, onProfile, onSearch }) {
  const [search, setSearch] = useState('');
  const fullName = `${user?.profile?.first_name || ''} ${user?.profile?.last_name || ''}`.trim();
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
      <div className="flex items-center gap-4 flex-1 max-w-2xl">
        <form role="search" onSubmit={event => { event.preventDefault(); onSearch(search.trim()); }} className="relative w-full">
          <input
            type="search" aria-label="Search products" value={search} onChange={event => setSearch(event.target.value)}
            placeholder="Search for products, categories..."
            className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-[#006e00]"
          />
          <button type="submit" aria-label="Search products in Browse" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><Search className="w-4 h-4" /></button>
        </form>
      </div>

      <div className="flex items-center gap-6">
        <button type="button" onClick={onCart} aria-label={"Open My Cart, " + quantity + " items"} className="relative p-2">
          <ShoppingCart className="w-5 h-5 text-gray-700" />
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] min-w-4 px-1 h-4 rounded-full flex items-center justify-center font-bold" aria-live="polite">{quantity}</span>
        </button>

        <button type="button" onClick={onNotifications} aria-label={unreadCount == null ? "Notifications, unread count unavailable" : "Notifications, " + unreadCount + " unread"} className="relative p-2">
          <Bell className="w-5 h-5 text-gray-700" />
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] min-w-4 px-1 h-4 rounded-full flex items-center justify-center font-bold" aria-live="polite">{unreadCount ?? "-"}</span>
        </button>

        <button type="button" onClick={onProfile} aria-label="Open your profile" className="flex items-center gap-2 border-l pl-4 border-gray-200">
          <div className="w-8 h-8 rounded-full bg-gray-200 border flex items-center justify-center text-gray-700">
            <User className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-gray-800">
            {fullName || 'Shopper'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
        </button>
      </div>
    </header>
  );
}

export default ShopperHeader;