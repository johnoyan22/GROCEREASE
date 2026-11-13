import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentUser } from '../../services/api';
import Navbar from '../../components/public/Navbar';
import HeroSection from '../../components/public/HeroSection';
import CategorySection from '../../components/public/CategorySection';
import { Sparkles } from 'lucide-react';
export default function LandingPage() {
  const [role, setRole] = useState(null);
  useEffect(() => { let active = true; getCurrentUser().then(user => { if (active) setRole(user.role?.slug); }).catch(() => {}); return () => { active = false; }; }, []);
  const shopPath = ({ shopper: '/shopper/dashboard', inventory_worker: '/inventory/dashboard', supervisor: '/supervisor', admin: '/admin/dashboard' })[role] || '/login';
  return <div className="bg-page"><Navbar /><main><HeroSection shopPath={shopPath} staff={role && role !== 'shopper'} /><CategorySection />
    <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-12 sm:px-8"><h2 className="text-2xl font-bold text-green-950 sm:text-3xl">From your list to your pickup</h2><ol className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[['Browse','Choose your supermarket and explore its products.'],['Add to cart','Build a list with current store prices and stock.'],['Checkout','Review your total, payment option and pickup schedule.'],['Prepare','Follow your order as the store team gets it ready.'],['Pick up','Complete payment and verified in-person collection.']].map(([title,description],index) => <li key={title} className="ge-card"><span className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-green-800 text-sm font-bold text-white">{index+1}</span><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm text-slate-600">{description}</p></li>)}</ol></section>
    <section id="recommendations" className="mx-auto max-w-7xl px-4 py-10 sm:px-8"><div className="rounded-3xl bg-green-900 p-6 text-white sm:p-10"><Sparkles className="mb-4" size={28} /><h2 className="text-2xl font-bold sm:text-3xl">A little help with your grocery list</h2><p className="mt-4 max-w-2xl leading-7 text-green-50">Explore recommendations and alternative products from your selected supermarket. Text requests can help organize a list; image understanding is available when the store’s AI service is configured.</p><p className="mt-3 max-w-2xl text-sm text-green-100">You review every suggested item. Recommendations do not place an order or reserve stock.</p><Link to={shopPath} className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-white px-5 py-2 text-sm font-semibold text-green-900">Explore GrocerEase</Link></div></section>
  </main><footer className="mt-8 border-t border-slate-200 bg-white px-4 py-7 text-sm text-slate-600"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3"><p>© 2026 GrocerEase</p><p>Shop thoughtfully. Pick up with ease.</p><Link to="/login" className="py-2 font-semibold text-green-800">Login to your account</Link></div></footer></div>;
}
