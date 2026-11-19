import { Link } from 'react-router-dom';
import { MapPin, Navigation, ArrowRight } from 'lucide-react';
import herobg from '../../assets/images/herobg.png';
import map from '../../assets/images/map.png';

export default function HeroSection() {
  return <section id="products" aria-label="Shop with GrocerEase" className="mx-auto mt-5 grid max-w-7xl gap-3 rounded-2xl bg-yellow-50 sm:mt-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
    <div className="min-w-0 rounded-2xl bg-cover bg-center bg-no-repeat px-5 py-8 sm:px-8 sm:py-12 lg:px-12" style={{ backgroundImage: `url(${herobg})` }}>
      <h1 className="text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">Smart Grocery<br /><span className="text-red-500">Shopping,</span><br /><span className="text-green-900">Made Easy.</span></h1>
      <p className="mt-4 max-w-lg text-base leading-relaxed text-green-900">Shop your groceries online, get AI-powered recommendations, and pick up in-store with ease.</p>
      <div className="mt-6 flex flex-col gap-3 font-semibold min-[400px]:flex-row sm:mt-8"><Link to="/login" className="flex min-h-12 items-center justify-center rounded-xl bg-red-500 px-5 py-3 text-center text-white hover:bg-red-600">Start Shopping</Link><Link to="/login" className="flex min-h-12 items-center justify-center rounded-xl border border-green-900 bg-white px-5 py-3 text-center text-green-800 hover:bg-green-50">View Orders</Link></div>
    </div>
    <div className="m-3 min-w-0 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-900 text-white"><MapPin className="h-5 w-5" /></span><div className="min-w-0"><h2 className="text-2xl font-bold text-green-900">Shop Near You.</h2><p className="mt-1 text-sm leading-relaxed text-green-900">Find a nearby supermarket for a quick in-store pickup.</p></div></div>
      <img src={map} alt="Map of the nearby supermarket" className="my-4 h-40 w-full rounded-xl border border-gray-200 object-cover sm:h-48" />
      <h3 className="text-xl font-bold text-green-900">Colonade Supermarket</h3><p className="mt-2 flex items-start gap-2 text-sm text-green-900"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />Colonade, Cebu City, 6000</p><p className="mt-2 text-sm text-green-900">0.6km away | <span className="font-semibold text-green-600">Open until 10:00pm</span></p>
      <button type="button" className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-green-900 px-4 py-2 text-sm font-semibold text-white"><Navigation className="h-4 w-4 shrink-0" />Get Directions</button><p className="mt-3 flex items-center gap-2 text-sm font-semibold text-green-600">View more nearby stores<ArrowRight className="h-4 w-4 shrink-0" /></p>
    </div>
  </section>;
}
