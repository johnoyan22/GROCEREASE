import ProductImage from '../shared/ProductImage';
import { maximumQuantity } from '../../services/cart';
import { ShoppingCart, ShoppingBag } from 'lucide-react';
import DashboardLoadState from '../DashboardLoadState';
import Logo from '../../assets/images/Logo.png';

function ShopperMainContent({ setActiveTab, shopping, summary }) {
  const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
  const localTime = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });
  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50">
      <div className="mb-6">
        <h1 className="text-2xl font-sans font-bold text-gray-900">Welcome, Shopper!</h1>
        <p className="text-xs text-gray-500">Ready for a fresh day</p>
      </div>

      <DashboardLoadState summary={summary} />
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column (Stats & Active Orders) */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 shrink-0 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                <ShoppingCart className="w-5 h-5 text-primary" />
              </div>
              <div>
                <span className="text-2xl font-bold text-black">{shopping.quantity}</span>
                <p className="text-xs text-gray-500">Items in Cart</p>
                <button
                  onClick={() => setActiveTab?.('Cart')}
                  className="text-xs text-primary font-bold hover:underline"
                >
                  View Cart →
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 shrink-0 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                <span className="text-lg font-bold text-primary">₱</span>
              </div>
              <div>
                <span className="text-2xl font-bold text-black">{shopping.pricesAvailable ? money.format(shopping.summary.subtotalCentavos / 100) : shopping.catalog.loading ? 'Loading...' : 'Not available'}</span>
                <p className="text-xs text-gray-500">Cart total</p>
                <button
                  onClick={() => setActiveTab?.('Cart')}
                  className="text-xs text-primary font-bold hover:underline"
                >
                  View Cart →
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 shrink-0 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                <ShoppingBag className="w-5 h-5 text-primary" />
              </div>
              <div>
                <span className="text-2xl font-bold text-black">{summary.loading ? 'Loading...' : summary.data?.active_orders ?? 'Not available'}</span>
                <p className="text-xs text-gray-500">Active Orders</p>
                <button
                  onClick={() => setActiveTab?.('Orders')}
                  className="text-xs text-primary font-bold hover:underline"
                >
                  View Orders →
                </button>
              </div>
            </div>
          </div>

          {/* Promo Banner */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 flex items-center justify-between relative overflow-hidden">
            <div className="max-w-xs z-10">
              <h2 className="text-2xl font-bold text-gray-900 leading-tight">Pick up in-store only</h2>
              <p className="text-xs text-gray-500 mt-2 mb-4">
                Shop online and pick up your order at our store. No delivery available.
              </p>
              <button
                onClick={() => setActiveTab?.('Pickup')}
                className="bg-primary hover:bg-primary-hover text-white text-xs font-bold py-2.5 px-5 rounded-lg transition"
              >
                View Pick up Info
              </button>
            </div>
            <img
              src={Logo}
              alt="GrocerEase"
              className="hidden h-28 w-28 shrink-0 object-contain sm:block"
            />
          </div>

          {/* Active Orders */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">My Active Orders</h3>
              <button
                onClick={() => setActiveTab?.('Orders')}
                className="text-xs text-primary font-bold hover:underline"
              >
                View All →
              </button>
            </div>

            {!summary.loading && !summary.error && summary.data?.recent_active_orders.length === 0 && <p className="text-sm text-gray-500">You have no active orders.</p>}
            <div className="space-y-3">{summary.data?.recent_active_orders.map(order => <div key={order.order_id} className="border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1"><p className="text-xs font-bold">Order #{order.order_id} - {order.store_name}</p><p className="text-xs text-gray-500">{order.pickup_window_start_at ? localTime.format(new Date(order.pickup_window_start_at)) + ' - ' + localTime.format(new Date(order.pickup_window_end_at)) : 'Pickup schedule unavailable'}</p></div>
              <div className="text-right space-y-2"><span className="inline-block bg-emerald-100 text-primary text-xs font-bold px-3 py-1 rounded-full">{order.status.replaceAll('_', ' ')} - {order.payment_status}</span><p className="text-xs font-bold">{order.item_quantity} items - {money.format(order.total_centavos / 100)}</p><button type="button" onClick={() => setActiveTab('Orders')} className="bg-emerald-100 text-primary font-bold text-xs px-4 py-1.5 rounded-lg">View Details</button></div>
            </div>)}</div>
          </div>
        </div>

        {/* Right Column (AI & Info) */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-gray-900">Smart shopping</h3>
              <button
                onClick={() => setActiveTab?.('AI')}
                className="text-xs text-primary font-bold hover:underline"
              >
                View All →
              </button>
            </div>

            <p className="mb-3 text-sm text-slate-600">Explore suggestions from your selected supermarket in AI Recommendations.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{shopping.catalog.products.filter(product => product.available_stock > 0).slice(0, 2).map(product => {
              const quantity = shopping.cart.items.find(item => item.store_inventory_id === product.store_inventory_id)?.quantity || 0;
              return <article key={product.store_inventory_id} className="rounded-xl border border-slate-200 p-3"><ProductImage product={product} className="mb-3 h-24 w-full" /><h4 className="text-sm font-semibold">{product.product_name}</h4><p className="mt-1 text-sm text-green-800">{money.format(product.selling_price)}{product.selling_unit && ' / ' + product.selling_unit}</p><button type="button" disabled={shopping.locked || quantity >= maximumQuantity(product)} onClick={() => shopping.changeQuantity(product, quantity + 1)} className="mt-3 w-full rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-800 disabled:opacity-50">Add to cart</button></article>;
            })}</div>
            {!shopping.storeId && <p className="mt-3 text-sm text-slate-600">Choose a supermarket in Browse to see real products.</p>}
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 min-h-[160px]">
            <h3 className="text-sm font-bold text-primary mb-2">Why pick up in-store?</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Save time by skipping checkout lines. Reserve your produce online and collect it directly at your designated store location!
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default ShopperMainContent;