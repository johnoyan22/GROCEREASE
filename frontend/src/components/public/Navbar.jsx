import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Search, X } from 'lucide-react';
import Logo from '../../assets/images/Logo.png';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const link = 'flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-semibold hover:bg-green-50';
  return <header className="border-b border-gray-200 bg-white"><nav aria-label="Main navigation" className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:gap-5 lg:py-4">
    <Link to="/" aria-label="GrocerEase home" className="mr-auto flex shrink-0 items-center gap-1 text-xl font-black sm:text-2xl"><img src={Logo} className="h-10 w-10 object-contain sm:h-12 sm:w-12" alt="" />Grocer<span className="-ml-1 text-green-700">Ease</span></Link>
    <Link to="/login" className="flex min-h-11 items-center justify-center rounded-lg border border-green-700 px-3 text-sm font-semibold text-green-700 hover:bg-green-50 lg:order-3">Login</Link>
    <button type="button" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="public-navigation" onClick={() => setOpen(value => !value)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 lg:hidden">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
    <div id="public-navigation" className={(open ? 'flex' : 'hidden') + ' w-full flex-col gap-3 border-t border-gray-100 pt-3 lg:order-2 lg:flex lg:w-auto lg:min-w-0 lg:flex-1 lg:flex-row lg:items-center lg:border-0 lg:pt-0'}>
      <div className="flex flex-wrap gap-1" onClick={() => setOpen(false)}><Link className={link} to="/">Home</Link><a className={link} href="#products">Products</a><a className={link} href="#categories">Categories</a></div>
      <div role="search" className="relative min-w-0 lg:ml-auto lg:max-w-64 lg:flex-1"><input aria-label="Search for products" type="search" placeholder="Search for products" className="min-h-11 w-full rounded-lg border border-gray-300 py-2 pl-3 pr-10 text-base sm:text-sm" /><Search aria-hidden="true" className="pointer-events-none absolute right-3 top-3 h-5 w-5 text-gray-500" /></div>
      <Link to="/register" className="flex min-h-11 items-center justify-center rounded-lg bg-red-500 px-4 text-sm font-semibold text-white hover:bg-red-600 lg:hidden">Register</Link>
    </div>
    <Link to="/register" className="order-4 hidden min-h-11 items-center justify-center rounded-lg bg-red-500 px-4 text-sm font-semibold text-white hover:bg-red-600 lg:flex">Register</Link>
  </nav></header>;
}
