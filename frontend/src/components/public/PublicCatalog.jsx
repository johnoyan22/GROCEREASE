import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPublicProducts } from '../../services/api';
import { storeDestination } from '../../services/storeIntent';
import ProductImage from '../shared/ProductImage';

const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

export default function PublicCatalog({ store, role, shopPath = '/login' }) {
  const [searchInput, setSearchInput] = useState(''), [search, setSearch] = useState(''), [category, setCategory] = useState(''), [page, setPage] = useState(1);
  const [data, setData] = useState(null), [error, setError] = useState(''), [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    getPublicProducts(store.store_id, { search, category, page, per_page: 12 }, { signal: controller.signal }).then(result => {
      if (result.store?.store_id !== store.store_id || !Array.isArray(result.products)) throw new Error('Unexpected public catalog response.');
      if (active) setData(result);
    }).catch(failure => { if (active && failure.name !== 'AbortError') setError(failure.status === 404 ? 'This store is no longer available for public browsing. Choose another registered store.' : 'Products could not be loaded. Please try again.'); });
    return () => { active = false; controller.abort(); };
  }, [store.store_id, search, category, page, version]);
  function changeSearch(event) { event.preventDefault(); setData(null); setError(''); setSearch(searchInput.trim()); setPage(1); setVersion(current => current + 1); }
  function changeCategory(value) { setData(null); setError(''); setCategory(value); setPage(1); }
  function changePage(value) { setData(null); setError(''); setPage(value); }
  return <section id="public-catalog" aria-labelledby="public-catalog-title" className="mx-auto mt-8 max-w-7xl scroll-mt-5 px-4 sm:px-8">
    <div className="rounded-2xl border border-green-100 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h2 id="public-catalog-title" className="text-2xl font-bold text-green-950">Available products · {store.store_name}</h2><p className="mt-2 break-words text-sm text-slate-600">{store.address}</p><p className="mt-2 text-sm text-slate-600">Browse freely. Login is required to use a cart or Checkout. Current prices and availability are checked again when ordering.</p></div>
        <div className="flex flex-wrap gap-2">{role === 'shopper' ? <Link to={storeDestination('/shopper/dashboard', store.store_id)} className="ge-button">Shop at this store</Link> : !role ? <><Link to={storeDestination('/login', store.store_id)} className="ge-button">Login to Start Shopping</Link><Link to={storeDestination('/register', store.store_id)} className="inline-flex min-h-11 items-center rounded-lg border border-green-800 px-4 text-sm font-semibold text-green-800">Create an Account to Shop</Link></> : <Link to={shopPath} className="ge-button">Open my workspace</Link>}</div>
      </div>
      <form onSubmit={changeSearch} className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(150px,220px)_auto]"><label className="text-sm font-medium">Search products<input type="search" value={searchInput} maxLength={100} onChange={event => setSearchInput(event.target.value)} placeholder="Name, category or size" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-medium">Category<select value={category} onChange={event => changeCategory(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">All categories</option>{(data?.categories || (category ? [category] : [])).map(value => <option key={value}>{value}</option>)}</select></label><button type="submit" className="ge-button self-end">Search</button></form>
      {!data && !error && <p role="status" className="py-8 text-sm text-slate-600">Loading available products…</p>}
      {error && <div role="alert" className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900"><p>{error}</p><button type="button" onClick={() => { setError(''); setVersion(current => current + 1); }} className="mt-2 min-h-11 font-semibold underline">Try again</button></div>}
      {data && <><p className="mt-4 text-sm text-slate-600">{data.pagination.total} matching products · Page {data.pagination.page} of {data.pagination.last_page}</p><div className="mt-4 grid gap-3 min-[375px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">{data.products.map(product => <article key={product.product_id} className="min-w-0 rounded-xl border border-slate-200 p-3 sm:p-4"><ProductImage product={product} className="mb-3 h-36 w-full" /><h3 className="break-words font-semibold text-green-950">{product.product_name}</h3><p className="mt-1 text-xs text-slate-600">{product.category}</p><p className="mt-1 text-sm text-slate-600">{product.size || 'Size not specified'}{product.selling_unit && ' · per ' + product.selling_unit}</p><p className="mt-3 break-words text-lg font-bold text-green-800">{money.format(Number(product.selling_price))}</p><p className="mt-1 text-xs font-semibold text-green-800">Available</p><p className="mt-2 break-words text-xs text-slate-500">{store.store_name}</p></article>)}</div>{data.products.length === 0 && <p className="py-8 text-sm text-slate-600">No available products match these filters. Try another search, category or supermarket.</p>}
        <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" disabled={page <= 1} onClick={() => changePage(page - 1)} className="min-h-11 rounded-lg border border-green-800 px-4 text-sm font-semibold disabled:opacity-40">Previous products</button><button type="button" disabled={page >= data.pagination.last_page} onClick={() => changePage(page + 1)} className="min-h-11 rounded-lg border border-green-800 px-4 text-sm font-semibold disabled:opacity-40">Next products</button></div>
      </>}
    </div>
  </section>;
}
