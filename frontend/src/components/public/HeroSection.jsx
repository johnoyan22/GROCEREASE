import { Link } from 'react-router-dom';
import heroBackground from '../../assets/images/herobg.png';
import StoreLocator from './StoreLocator';

export default function HeroSection({ shopPath = '/login', staff = false }) {
  return <section className="mx-auto mt-6 grid max-w-7xl gap-3 px-4 sm:mt-10 sm:px-8 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
    <div className="relative min-w-0 overflow-hidden rounded-2xl bg-yellow-50">
      <img src={heroBackground} alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover object-right" />
      <div className="absolute inset-0 bg-gradient-to-r from-yellow-50 via-yellow-50/85 to-transparent" />
      <div className="relative flex min-h-[440px] flex-col justify-center px-6 py-10 sm:min-h-[490px] sm:px-10 sm:py-14">
        <h1 className="max-w-md text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">Smart Grocery<br /><span className="text-red-500">Shopping,</span><br /><span className="text-green-900">Made Easy.</span></h1>
        <p className="mt-4 max-w-sm text-base leading-7 text-green-900">Shop your groceries online, explore AI-assisted recommendations, and pick up in-store with ease.</p>
        <div className="mt-8 flex flex-wrap items-center gap-3 font-semibold">
          <Link to={shopPath} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-500 px-5 py-3 text-sm text-white hover:bg-red-600">{staff ? 'Open workspace' : 'Start Shopping'}</Link>
          <a href="#store-locator" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-green-900 bg-white px-5 py-3 text-sm text-green-800 hover:bg-green-50">Find a store</a>
        </div>
        <p className="mt-5 max-w-xs text-xs leading-5 text-green-950">Products, prices and pickup schedules come from the supermarket you select.</p>
      </div>
    </div>
    <StoreLocator shopPath={shopPath} />
  </section>;
}
