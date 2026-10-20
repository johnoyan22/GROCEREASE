import { useState } from 'react';
import { maximumQuantity } from '../../services/cart';
import ShopperCheckout from './ShopperCheckout';

const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

export default function ShopperMyCart({ shopping, userId, onContinue }) {
  const { cart, catalog, summary, quantity, pricesAvailable, locked, recovery, message,
    changeQuantity, removeItem, refresh, orderPlaced } = shopping;
  const [checkoutCart, setCheckoutCart] = useState(null);
  return <main className="bg-gray-50 p-6">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">My Cart</h1><p className="mt-1 text-sm text-gray-600">{catalog.store?.store_name ?? (catalog.error ? 'Selected supermarket unavailable' : cart.store_id ? 'Loading selected supermarket...' : 'Choose a supermarket in Browse Products.')}</p></div>
      <button type="button" onClick={refresh} disabled={recovery.loading} className="rounded-lg border border-green-700 bg-white px-4 py-2 text-sm text-green-800">Refresh prices and stock</button>
    </div>
    {catalog.loading && <p role="status" className="mb-4 text-sm">Loading current products and prices...</p>}
    {catalog.error && <p role="alert" className="mb-4 text-sm text-red-700">{catalog.error}</p>}
    {recovery.loading && <p role="status" className="mb-4 text-sm">Checking previous checkout...</p>}
    {(recovery.error || message) && <p role="alert" className="mb-4 text-sm text-red-700">{recovery.error || message}</p>}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-label="Cart items" className="space-y-4">
        {cart.items.length === 0 && <div className="rounded-xl border border-gray-200 bg-white p-6"><h2 className="font-semibold">Your cart is empty</h2><p className="mt-2 text-sm text-gray-500">Browse your supermarket to add products.</p></div>}
        {!catalog.loading && summary.rows.map(row => <article key={row.store_inventory_id} className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold">{row.product?.product_name ?? 'Unavailable product #' + row.store_inventory_id}</h2>
          {row.product && <><p className="mt-1 text-sm text-gray-600">{row.product.category} · {row.product.size || 'Size not provided'}</p><p className="mt-1 text-xs text-gray-500">SKU: {row.product.sku} · Barcode: {row.product.barcode || 'Not provided'}</p><p className="mt-2 text-sm">Current price: {money.format(row.product.selling_price)}</p><p className="mt-1 text-xs text-gray-500">Available: {row.product.available_stock} · Limit/order: {row.product.max_per_order ?? 'No extra limit'}</p></>}
          {row.error && <p role="alert" className="mt-2 text-sm text-red-700">{row.error}</p>}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            {row.product && <label className="text-sm">Quantity<input aria-label={'Cart quantity for ' + row.product.product_name} type="number" min="1" max={maximumQuantity(row.product)} step="1" value={row.quantity} disabled={locked} onChange={event => changeQuantity(row.product, Number(event.target.value))} className="ml-3 w-20 rounded border border-gray-300 p-2" /></label>}
            <span className="text-sm font-semibold">Subtotal: {row.product && !row.priceError ? money.format(row.lineCentavos / 100) : 'Not available'}</span>
            <button type="button" disabled={locked} onClick={() => removeItem(row.store_inventory_id)} className="text-sm font-semibold text-red-700">Remove<span className="sr-only"> {row.product?.product_name ?? row.store_inventory_id}</span></button>
          </div>
        </article>)}
      </section>
      <aside aria-label="Cart summary" className="h-fit rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Order summary</h2><p className="mt-2 text-sm">{quantity} items</p>
        <p className="mt-4 font-semibold">Subtotal: {pricesAvailable ? money.format(summary.subtotalCentavos / 100) : catalog.loading ? 'Loading...' : 'Not available'}</p>
        <p className="mt-2 text-xs text-gray-600">Service charge: not configured. No service charge is added.</p>
        <p className="mt-3 text-xs text-gray-500">Checkout checks prices, stock, limits and your pickup schedule again. Adding to your cart does not reserve stock.</p>
        <button type="button" disabled={locked || !summary.valid || !pricesAvailable} onClick={() => setCheckoutCart({ store_id: cart.store_id, items: cart.items.map(item => ({ ...item })) })} className="mt-4 w-full rounded-lg bg-green-700 p-3 text-sm text-white disabled:opacity-40">Proceed to Checkout</button>
        <button type="button" onClick={onContinue} className="mt-3 w-full rounded-lg border border-gray-300 p-3 text-sm">Continue Shopping</button>
      </aside>
    </div>
    {checkoutCart && <ShopperCheckout cart={checkoutCart} userId={userId} onPlaced={orderPlaced} onClose={() => { setCheckoutCart(null); refresh(); }} />}
  </main>;
}
