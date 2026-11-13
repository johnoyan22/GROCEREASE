import { useState } from 'react';
import { Search, ShoppingCart, Bell, Menu } from 'lucide-react';
import Avatar from '../shared/Avatar';
export default function ShopperHeader({ user, quantity = 0, unreadCount, onCart, onNotifications, onProfile, onSearch, onNavigation }) {
  const [search, setSearch] = useState('');
  const fullName = [user?.profile?.first_name, user?.profile?.last_name].filter(Boolean).join(' ');
  return <header className="z-10 flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-3 sm:px-5">
    <button type="button" aria-label="Open navigation menu" onClick={onNavigation} className="rounded-lg p-2 lg:hidden"><Menu size={22} /></button>
    <span className="mr-auto text-base font-bold text-green-900 md:hidden">GrocerEase</span>
    <form role="search" onSubmit={event => { event.preventDefault(); onSearch(search.trim()); }} className="relative order-last w-full md:order-none md:mr-auto md:max-w-2xl md:flex-1">
      <input type="search" aria-label="Search products" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search products or categories" className="w-full rounded-lg border border-slate-300 py-2 pl-3 pr-12 text-sm" />
      <button type="submit" aria-label="Search products in Browse" className="absolute right-0 top-0 flex h-full w-11 items-center justify-center text-slate-600"><Search size={18} /></button>
    </form>
    <div className="flex shrink-0 items-center gap-1 sm:gap-3">
      <button type="button" onClick={onCart} aria-label={'Open My Cart, ' + quantity + ' items'} className="relative flex w-11 items-center justify-center rounded-lg"><ShoppingCart size={20} /><span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-green-800 px-1 text-xs font-semibold text-white" aria-live="polite">{quantity}</span></button>
      <button type="button" onClick={onNotifications} aria-label={unreadCount == null ? 'Notifications, unread count unavailable' : 'Notifications, ' + unreadCount + ' unread'} className="relative flex w-11 items-center justify-center rounded-lg"><Bell size={20} /><span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-green-800 px-1 text-xs text-white">{unreadCount ?? '–'}</span></button>
      <button type="button" onClick={onProfile} aria-label="Open your profile" className="flex items-center gap-2 rounded-lg p-1"><Avatar profile={user?.profile} imageUrl={user?.profile?.image_url} className="h-9 w-9" /><span className="hidden max-w-40 truncate text-sm font-semibold lg:inline">{fullName || 'Shopper'}</span></button>
    </div>
  </header>;
}
