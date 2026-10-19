import { useCallback, useEffect, useState } from 'react';
import { getShopperProducts, getShopperStores } from '../../services/api';
import { cartSummary, changeCartQuantity, maximumQuantity, readSavedCart } from '../../services/cart';
import { clearCheckoutAttempt } from '../../services/checkout';
import ShopperCheckout from './ShopperCheckout';

const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

export default function ShopperBrowseProducts({ userId }) {
  const [cart, setCart] = useState(function () { return readSavedCart(sessionStorage, userId); });
  const [storeId, setStoreId] = useState(cart.store_id);
  const [stores, setStores] = useState([]);
  const [storesError, setStoresError] = useState('');
  const [storesLoading, setStoresLoading] = useState(true);
  const [catalog, setCatalog] = useState({ store: null, products: [], loading: Boolean(cart.store_id), error: '' });
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('name');
  const [pendingStoreId, setPendingStoreId] = useState(null);
  const [message, setMessage] = useState('');
  const [checkoutCart, setCheckoutCart] = useState(null);
  const summary = cartSummary(cart, catalog.products);
  const categories = [...new Set(catalog.products.map(function (item) { return item.category; }))].sort();
  const products = catalog.products.filter(function (item) {
    return [item.product_name, item.sku, item.barcode, item.size].join(' ').toLowerCase().includes(search.toLowerCase())
      && (!category || category === item.category);
  }).sort(function (first, second) {
    if (sort === 'price_low') return Number(first.selling_price) - Number(second.selling_price);
    if (sort === 'price_high') return Number(second.selling_price) - Number(first.selling_price);
    return first.product_name.localeCompare(second.product_name);
  });

  useEffect(function () {
    const controller = new AbortController();
    let active = true;
    async function loadStores() {
      try {
        const result = await getShopperStores({ signal: controller.signal });
        if (!Array.isArray(result.stores)) throw new Error('Unexpected store response.');
        if (active) setStores(result.stores);
      } catch (error) {
        if (active && error.name !== 'AbortError') setStoresError(error.message);
      } finally {
        if (active) setStoresLoading(false);
      }
    }
    loadStores();
    return function () { active = false; controller.abort(); };
  }, [version]);

  useEffect(function () {
    if (!storeId) return;
    const controller = new AbortController();
    let active = true;
    async function loadProducts() {
      try {
        const result = await getShopperProducts(storeId, { signal: controller.signal });
        if (result.store?.store_id !== storeId || !Array.isArray(result.products)) throw new Error('Unexpected store products response.');
        if (active) setCatalog({ store: result.store, products: result.products, loading: false, error: '' });
      } catch (error) {
        if (active && error.name !== 'AbortError') setCatalog({ store: null, products: [], loading: false, error: error.message });
      }
    }
    loadProducts();
    return function () { active = false; controller.abort(); };
  }, [storeId, version]);

  useEffect(function () {
    try {
      sessionStorage.setItem('grocerease-cart-' + userId, JSON.stringify(cart));
    } catch {
      // The in-memory cart still works when browser storage is unavailable.
    }
  }, [cart, userId]);

  function refresh() {
    setStoresError('');
    setStoresLoading(true);
    setCatalog({ store: null, products: [], loading: Boolean(storeId), error: '' });
    setVersion(function (current) { return current + 1; });
  }

  function switchStore(nextId) {
    setCart({ store_id: nextId, items: [] });
    setStoreId(nextId);
    setCatalog({ store: null, products: [], loading: true, error: '' });
    setSearch('');
    setCategory('');
    setPendingStoreId(null);
    setMessage('');
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

  function changeQuantity(product, quantity) {
    try {
      setCart(changeCartQuantity(cart, storeId, product, quantity));
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    }
  }

  function removeItem(itemId) {
    setCart({ store_id: cart.store_id, items: cart.items.filter(function (item) { return item.store_inventory_id !== itemId; }) });
  }

  const orderPlaced = useCallback(function (order, key) {
    const clearedCart = { store_id: order.store_id, items: [] };
    try {
      // Clear the persisted cart before forgetting the retry key.
      sessionStorage.setItem('grocerease-cart-' + userId, JSON.stringify(clearedCart));
      clearCheckoutAttempt(sessionStorage, userId, key);
    } catch {
      // Retain the attempt if storage fails so a refresh can recover the original order.
    }
    setCart(clearedCart);
  }, [userId]);

  return (
    <main className="bg-gray-50 p-6">
      <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row">
        <div><h1 className="text-2xl font-bold">Browse Store Products</h1><p className="mt-1 text-sm text-gray-600">Choose one store for your cart. Items are reserved only when an order is successfully placed.</p></div>
        <button type="button" onClick={refresh} className="rounded-lg border border-green-700 bg-white px-4 py-2 text-sm text-green-800">Refresh products</button>
      </div>
      <label className="block text-sm font-semibold">Shop at<select value={storeId ?? ''} onChange={selectStore} disabled={storesLoading} className="mt-2 w-full rounded-lg border border-gray-300 bg-white p-3"><option value="">Choose an active store</option>{stores.map(function (store) { return <option key={store.store_id} value={store.store_id}>{store.store_name} - {store.address}</option>; })}</select></label>
      {storesLoading && <p role="status" className="mt-3 text-sm">Loading stores...</p>}
      {storesError && <p role="alert" className="mt-3 text-sm text-red-700">{storesError}</p>}
      {!storesLoading && !storesError && stores.length === 0 && <p className="mt-3 text-sm">No active stores are available.</p>}
      {pendingStoreId && <div role="alert" className="my-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm"><p>Switching stores clears your current cart. Continue?</p><div className="mt-3 flex gap-3"><button type="button" onClick={function () { switchStore(pendingStoreId); }} className="rounded-lg bg-green-700 px-4 py-2 text-white">Clear cart and switch</button><button type="button" onClick={function () { setPendingStoreId(null); }} className="rounded-lg border border-gray-300 bg-white px-4 py-2">Keep current store</button></div></div>}
      {catalog.loading && <p role="status" className="my-5">Loading store products...</p>}
      {catalog.error && <p role="alert" className="my-5 text-red-700">{catalog.error}</p>}
      {message && <p role="alert" className="my-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          {catalog.store && <h2 className="mb-3 text-lg font-semibold">{catalog.store.store_name}</h2>}
          {catalog.store && !catalog.loading && <div className="mb-4 grid gap-3 md:grid-cols-3"><input aria-label="Search store products" type="search" value={search} onChange={function (event) { setSearch(event.target.value); }} placeholder="Search name, SKU, barcode..." className="rounded-lg border border-gray-300 bg-white p-2.5 text-sm" /><select aria-label="Product category" value={category} onChange={function (event) { setCategory(event.target.value); }} className="rounded-lg border border-gray-300 bg-white p-2.5 text-sm"><option value="">All categories</option>{categories.map(function (value) { return <option key={value}>{value}</option>; })}</select><select aria-label="Product sort order" value={sort} onChange={function (event) { setSort(event.target.value); }} className="rounded-lg border border-gray-300 bg-white p-2.5 text-sm"><option value="name">Name</option><option value="price_low">Price: low to high</option><option value="price_high">Price: high to low</option></select></div>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map(function (product) {
              const item = cart.items.find(function (row) { return row.store_inventory_id === product.store_inventory_id; });
              const quantity = item?.quantity ?? 0;
              return <article key={product.store_inventory_id} className="rounded-xl border border-gray-200 bg-white p-4"><div aria-hidden="true" className="mb-3 flex h-20 items-center justify-center rounded-lg bg-green-50 text-2xl font-bold text-green-800">{product.product_name.slice(0, 2).toUpperCase()}</div><h3 className="font-semibold">{product.product_name}</h3><p className="mt-1 text-sm text-gray-500">{product.size}</p><p className="mt-2 font-semibold text-green-800">{money.format(product.selling_price)}</p><p className="mt-2 text-xs text-gray-600">Available: {product.available_stock} · Limit/order: {product.max_per_order ?? 'No extra limit'}</p>{product.is_low_stock && <p className="mt-1 text-xs text-amber-800">Low stock</p>}<details className="mt-3 text-xs text-gray-600"><summary className="cursor-pointer font-medium">Product details</summary><p className="mt-2">Category: {product.category}</p><p>SKU: {product.sku}</p><p>Barcode: {product.barcode ?? 'Not provided'}</p></details><button type="button" disabled={catalog.loading || quantity >= maximumQuantity(product)} onClick={function () { changeQuantity(product, quantity + 1); }} className="mt-4 w-full rounded-lg bg-green-700 px-3 py-2 text-sm text-white disabled:opacity-40">Add to cart</button></article>;
            })}
          </div>
          {catalog.store && !catalog.loading && products.length === 0 && <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">No matching active products in this store.</p>}
        </section>
        <aside aria-label="Shopping cart" className="h-fit rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Your cart</h2>
          {cart.items.length === 0 && <p className="mt-3 text-sm text-gray-500">Your cart is empty.</p>}
          {!catalog.loading && summary.rows.map(function (row) {
            return <div key={row.store_inventory_id} className="mt-4 border-t border-gray-100 pt-4"><h3 className="text-sm font-semibold">{row.product?.product_name ?? 'Unavailable product #' + row.store_inventory_id}</h3>{row.error && <p className="mt-2 text-xs text-red-700">{row.error}</p>}<div className="mt-3 flex items-center justify-between gap-3">{row.product && <label className="text-xs">Quantity<input aria-label={'Cart quantity for ' + row.product.product_name} type="number" min="1" max={maximumQuantity(row.product)} step="1" value={row.quantity} onChange={function (event) { changeQuantity(row.product, Number(event.target.value)); }} className="ml-2 w-20 rounded border border-gray-300 p-1" /></label>}<button type="button" onClick={function () { removeItem(row.store_inventory_id); }} className="text-xs font-semibold text-red-700">Remove</button></div><p className="mt-2 text-sm">{money.format(row.lineCentavos / 100)}</p></div>;
          })}
          <p className="mt-5 border-t border-gray-200 pt-4 font-semibold">Estimated subtotal: {money.format(summary.subtotalCentavos / 100)}</p>
          <p className="mt-2 text-xs text-gray-500">Prices, stock, fees, and limits must be validated again at Checkout.</p>
          <button type="button" disabled={!summary.valid || catalog.loading || Boolean(catalog.error)} onClick={function () { setCheckoutCart({ store_id: cart.store_id, items: cart.items.map(function (item) { return { ...item }; }) }); }} className="mt-4 w-full rounded-lg bg-green-700 p-3 text-sm text-white disabled:opacity-40">Review Cash on Pickup</button>
        </aside>
      </div>
      {checkoutCart && <ShopperCheckout cart={checkoutCart} userId={userId} onPlaced={orderPlaced} onClose={function () { setCheckoutCart(null); refresh(); }} />}
    </main>
  );
}
