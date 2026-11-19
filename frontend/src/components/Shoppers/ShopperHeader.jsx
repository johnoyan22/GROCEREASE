import { useState } from 'react';
import { Search, ShoppingCart, Bell, User, ChevronDown, Menu } from 'lucide-react';

export default function ShopperHeader({ user, quantity = 0, unreadCount, onCart, onNotifications, onProfile, onSearch, onMenu, menuOpen = false }) {
  const [search, setSearch] = useState('');
  const fullName = `${user?.profile?.first_name || ''} ${user?.profile?.last_name || ''}`.trim();
  const iconButton = 'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100';
  return <header className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
    <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 lg:flex-nowrap lg:gap-6">
      <div className="flex w-full min-w-0 items-center gap-2 lg:order-last lg:w-auto">
        <button type="button" aria-label="Open Shopper menu" aria-expanded={menuOpen} aria-controls="shopper-mobile-menu" onClick={onMenu} className={iconButton + ' lg:hidden'}><Menu className="h-5 w-5" /></button>
        <span className="min-w-0 flex-1 truncate text-base font-black lg:hidden">Grocer<span className="text-[#006e00]">Ease</span></span>
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <button type="button" onClick={onCart} aria-label={'Open My Cart, ' + quantity + ' items'} className={iconButton}><ShoppingCart className="h-5 w-5" /><span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white" aria-live="polite">{quantity}</span></button>
          <button type="button" onClick={onNotifications} aria-label={unreadCount == null ? 'Notifications, unread count unavailable' : 'Notifications, ' + unreadCount + ' unread'} className={iconButton}><Bell className="h-5 w-5" /><span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white" aria-live="polite">{unreadCount ?? '-'}</span></button>
          <button type="button" onClick={onProfile} aria-label="Open your profile" className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-1 hover:bg-gray-100 xl:border-l xl:border-gray-200 xl:pl-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-gray-100"><User className="h-4 w-4" /></span><span title={fullName} className="hidden max-w-40 truncate text-sm font-semibold xl:block">{fullName || 'Shopper'}</span><ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-gray-500 xl:block" /></button>
        </div>
      </div>
      <form role="search" onSubmit={event => { event.preventDefault(); onSearch(search.trim()); }} className="relative w-full min-w-0 lg:order-first lg:max-w-2xl lg:flex-1">
        <input type="search" aria-label="Search products" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search for products, categories..." className="min-h-11 w-full rounded-lg border border-gray-300 py-2 pl-3 pr-12 text-base focus:border-[#006e00] focus:outline-none sm:text-sm" />
        <button type="submit" aria-label="Search products in Browse" className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:text-green-800"><Search className="h-5 w-5" /></button>
      </form>
    </div>
  </header>;
}
