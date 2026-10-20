import { useState } from 'react';
import { maximumQuantity } from '../../services/cart';

const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

export default function ShopperBrowseProducts({ shopping, search, setSearch, onViewCart }) {
  const { cart, storeId, stores, storesError, storesLoading, catalog, summary, quantity: cartQuantity,
    pricesAvailable, refresh, switchStore: changeStore, changeQuantity, message, recovery, locked } = shopping;
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('name');
  const [pendingStoreId, setPendingStoreId] = useState(null);
  const categories = [...new Set(catalog.products.map(function (item) { return item.category; }))].sort();
  const products = catalog.products.filter(function (item) {
    return [item.product_name, item.category, item.sku, item.barcode, item.size].join(' ').toLowerCase().includes(search.toLowerCase())
      && (!category || category === item.category);
  }).sort(function (first, second) {
    if (sort === 'price_low') return Number(first.selling_price) - Number(second.selling_price);
    if (sort === 'price_high') return Number(second.selling_price) - Number(first.selling_price);
    return first.product_name.localeCompare(second.product_name);
  });

  function switchStore(nextId) {
    changeStore(nextId); setSearch(''); setCategory(''); setPendingStoreId(null);
  }

  function selectStore(event) {
    const nextId = Number(event.target.value);
    if (!nextId || nextId === storeId) return;
    if (cart.items.length > 0 && cart.store_id !== nextId) {
      setPendingStoreId(nextId);
    } else {
      switchStore(nextId);
    }
  }

  return (
    <main className="bg-gray-50 p-6">
      <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row">
        <div><h1 className="text-2xl font-bold">Browse Store Products</h1><p className="mt-1 text-sm text-gray-600">Choose one store for your cart. Items are reserved only when an order is successfully placed.</p></div>
        <button type="button" onClick={refresh} className="rounded-lg border border-green-700 bg-white px-4 py-2 text-sm text-green-800">Refresh products</button>
      </div>
      <label className="block text-sm font-semibold">Shop at<select value={storeId ?? ''} onChange={selectStore} disabled={storesLoading || locked} className="mt-2 w-full rounded-lg border border-gray-300 bg-white p-3"><option value="">Choose an active store</option>{stores.map(function (store) { return <option key={store.store_id} value={store.store_id}>{store.store_name} - {store.address}</option>; })}</select></label>
      {storesLoading && <p role="status" className="mt-3 text-sm">Loading stores...</p>}
      {storesError && <p role="alert" className="mt-3 text-sm text-red-700">{storesError}</p>}
      {!storesLoading && !storesError && stores.length === 0 && <p className="mt-3 text-sm">No active stores are available.</p>}
      {pendingStoreId && <div role="alert" className="my-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm"><p>Switching stores clears your current cart. Continue?</p><div className="mt-3 flex gap-3"><button type="button" onClick={function () { switchStore(pendingStoreId); }} className="rounded-lg bg-green-700 px-4 py-2 text-white">Clear cart and switch</button><button type="button" onClick={function () { setPendingStoreId(null); }} className="rounded-lg border border-gray-300 bg-white px-4 py-2">Keep current store</button></div></div>}
      {catalog.loading && <p role="status" className="my-5">Loading store products...</p>}
      {catalog.error && <p role="alert" className="my-5 text-red-700">{catalog.error}</p>}
      {recovery.loading && <p role="status" className="mt-3 text-sm">Checking previous checkout...</p>}
      {recovery.error && <p role="alert" className="mt-3 text-sm text-red-700">{recovery.error}</p>}
      {message && <p role="alert" className="my-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          {catalog.store && <h2 className="mb-3 text-lg font-semibold">{catalog.store.store_name}</h2>}
          {catalog.store && !catalog.loading && <div className="mb-4 grid gap-3 md:grid-cols-3"><input aria-label="Search store products" type="search" value={search} onChange={function (event) { setSearch(event.target.value); }} placeholder="Search name, SKU, barcode..." className="rounded-lg border border-gray-300 bg-white p-2.5 text-sm" /><select aria-label="Product category" value={category} onChange={function (event) { setCategory(event.target.value); }} className="rounded-lg border border-gray-300 bg-white p-2.5 text-sm"><option value="">All categories</option>{categories.map(function (value) { return <option key={value}>{value}</option>; })}</select><select aria-label="Product sort order" value={sort} onChange={function (event) { setSort(event.target.value); }} className="rounded-lg border border-gray-300 bg-white p-2.5 text-sm"><option value="name">Name</option><option value="price_low">Price: low to high</option><option value="price_high">Price: high to low</option></select></div>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map(function (product) {
              const item = cart.items.find(function (row) { return row.store_inventory_id === product.store_inventory_id; });
              const quantity = item?.quantity ?? 0;
              return <article key={product.store_inventory_id} className="rounded-xl border border-gray-200 bg-white p-4"><div aria-hidden="true" className="mb-3 flex h-20 items-center justify-center rounded-lg bg-green-50 text-2xl font-bold text-green-800">{product.product_name.slice(0, 2).toUpperCase()}</div><h3 className="font-semibold">{product.product_name}</h3><p className="mt-1 text-sm text-gray-500">{product.size}</p><p className="mt-2 font-semibold text-green-800">{money.format(product.selling_price)}</p><p className="mt-2 text-xs text-gray-600">Available: {product.available_stock} · Limit/order: {product.max_per_order ?? 'No extra limit'}</p>{product.is_low_stock && <p className="mt-1 text-xs text-amber-800">Low stock</p>}<details className="mt-3 text-xs text-gray-600"><summary className="cursor-pointer font-medium">Product details</summary><p className="mt-2">Category: {product.category}</p><p>SKU: {product.sku}</p><p>Barcode: {product.barcode ?? 'Not provided'}</p></details><button type="button" disabled={locked || catalog.loading || quantity >= maximumQuantity(product)} onClick={function () { changeQuantity(product, quantity + 1); }} className="mt-4 w-full rounded-lg bg-green-700 px-3 py-2 text-sm text-white disabled:opacity-40">Add to cart</button></article>;
            })}
          </div>
          {catalog.store && !catalog.loading && products.length === 0 && <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">No matching active products in this store.</p>}
        </section>
        <aside aria-label="Shopping cart" className="h-fit rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Your cart</h2>
          <p className="mt-3 text-sm text-gray-600">{cartQuantity === 0 ? 'Your cart is empty.' : cartQuantity + ' items in your cart.'}</p>
          <p className="mt-5 border-t border-gray-200 pt-4 font-semibold">Subtotal: {pricesAvailable ? money.format(summary.subtotalCentavos / 100) : catalog.loading ? 'Loading prices...' : 'Not available'}</p>
          <p className="mt-2 text-xs text-gray-500">Review quantities, current prices and stock in My Cart before Checkout.</p>
          <button type="button" onClick={onViewCart} className="mt-4 w-full rounded-lg bg-green-700 p-3 text-sm text-white">View Cart</button>
        </aside>
      </div>
    </main>
  );
}
