import { Link } from 'react-router-dom';
import fruit from '../../assets/categories/fruit.webp';
import vegetables from '../../assets/categories/vegetables.webp';
import dairy from '../../assets/categories/dairy-eggs.webp';
import beverages from '../../assets/categories/beverages.webp';
import meat from '../../assets/categories/meat-poultry.webp';

export default function CategorySection({ shopPath = '/login' }) {
  return <section id="categories" className="mx-auto mt-10 max-w-7xl px-4 pb-10 sm:mt-16 sm:px-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-bold text-green-900 sm:text-3xl">Shop By Categories</h2><Link to={shopPath} className="inline-flex min-h-11 items-center text-sm font-semibold text-red-700">View products →</Link></div>
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 sm:gap-5">{[['Fruits', fruit], ['Vegetables', vegetables], ['Dairy & Eggs', dairy], ['Beverages', beverages], ['Meat & Poultry', meat]].map(([label, image]) => <article key={label} className="overflow-hidden rounded-xl border border-slate-200 bg-white"><img src={image} alt="" loading="lazy" decoding="async" width="1254" height="1254" className="aspect-square w-full object-cover" /><h3 className="px-3 py-4 text-sm font-semibold text-green-950 sm:text-base">{label}</h3></article>)}</div>
    <p className="mt-4 text-xs text-slate-600">Category images are illustrative. Browse a registered store for its actual products and availability.</p>
  </section>;
}
