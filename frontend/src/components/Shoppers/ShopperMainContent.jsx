import { ShoppingCart, ShoppingBag } from 'lucide-react';
import DashboardLoadState from '../DashboardLoadState';
import Logo from '../../assets/images/Logo.png';

function ShopperMainContent({ setActiveTab, shopping, summary }) {
  const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
  const localTime = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });
  return (
    <main className="min-w-0 p-4 sm:p-6 xl:p-8 bg-gray-50">
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-gray-900">Welcome, Shopper!</h1>
        <p className="text-xs text-gray-500">Ready for a fresh day</p>
      </div>

      <DashboardLoadState summary={summary} />
      <div className="grid grid-cols-12 gap-4 sm:gap-6">
        {/* Left Column (Stats & Active Orders) */}
        <div className="min-w-0 col-span-12 lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3 sm:gap-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex min-w-0 items-center gap-3 min-[480px]:flex-col min-[480px]:items-start 2xl:flex-row 2xl:items-center">
              <div className="h-10 w-10 shrink-0 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                <ShoppingCart className="w-5 h-5 text-[#006e00]" />
              </div>
              <div>
                <span className="break-words text-xl font-bold text-black sm:text-2xl">{shopping.quantity}</span>
                <p className="text-[11px] text-gray-500">Items in Cart</p>
                <button
                  onClick={() => setActiveTab?.('Cart')}
                  className="text-[11px] text-[#006e00] font-bold hover:underline"
                >
                  View Cart →
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex min-w-0 items-center gap-3 min-[480px]:flex-col min-[480px]:items-start 2xl:flex-row 2xl:items-center">
              <div className="h-10 w-10 shrink-0 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                <span className="text-lg font-bold text-[#006e00]">₱</span>
              </div>
              <div>
                <span className="break-words text-xl font-bold text-black sm:text-2xl">{shopping.pricesAvailable ? money.format(shopping.summary.subtotalCentavos / 100) : shopping.catalog.loading ? 'Loading...' : 'Not available'}</span>
                <p className="text-[11px] text-gray-500">Cart total</p>
                <button
                  onClick={() => setActiveTab?.('Cart')}
                  className="text-[11px] text-[#006e00] font-bold hover:underline"
                >
                  View Cart →
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex min-w-0 items-center gap-3 min-[480px]:flex-col min-[480px]:items-start 2xl:flex-row 2xl:items-center">
              <div className="h-10 w-10 shrink-0 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                <ShoppingBag className="w-5 h-5 text-[#006e00]" />
              </div>
              <div>
                <span className="break-words text-xl font-bold text-black sm:text-2xl">{summary.loading ? 'Loading...' : summary.data?.active_orders ?? 'Not available'}</span>
                <p className="text-[11px] text-gray-500">Active Orders</p>
                <button
                  onClick={() => setActiveTab?.('Orders')}
                  className="text-[11px] text-[#006e00] font-bold hover:underline"
                >
                  View Orders →
                </button>
              </div>
            </div>
          </div>

          {/* Promo Banner */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 flex items-center justify-between gap-4 relative overflow-hidden">
            <div className="max-w-xs z-10">
              <h2 className="text-2xl font-bold text-gray-900 leading-tight">Pick up in-store only</h2>
              <p className="text-xs text-gray-500 mt-2 mb-4">
                Shop online and pick up your order at our store. No delivery available.
              </p>
              <button
                onClick={() => setActiveTab?.('Pickup')}
                className="bg-[#006e00] hover:bg-[#005400] text-white text-xs font-bold py-2.5 px-5 rounded-lg transition"
              >
                View Pick up Info
              </button>
            </div>
            <img
              src={Logo}
              alt="GrocerEase"
              className="hidden h-28 w-28 shrink-0 object-contain sm:block xl:h-32 xl:w-32"
            />
          </div>

          {/* Active Orders */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">My Active Orders</h3>
              <button
                onClick={() => setActiveTab?.('Orders')}
                className="text-xs text-[#006e00] font-bold hover:underline"
              >
                View All →
              </button>
            </div>

            {!summary.loading && !summary.error && summary.data?.recent_active_orders.length === 0 && <p className="text-sm text-gray-500">You have no active orders.</p>}
            <div className="space-y-3">{summary.data?.recent_active_orders.map(order => <div key={order.order_id} className="border border-gray-200 rounded-xl p-4 flex min-w-0 flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div className="space-y-1"><p className="text-xs font-bold">Order #{order.order_id} - {order.store_name}</p><p className="text-xs text-gray-500">{order.pickup_window_start_at ? localTime.format(new Date(order.pickup_window_start_at)) + ' - ' + localTime.format(new Date(order.pickup_window_end_at)) : 'Pickup schedule unavailable'}</p></div>
              <div className="min-w-0 space-y-2 sm:text-right"><span className="inline-block bg-emerald-100 text-[#006e00] text-[10px] font-bold px-3 py-1 rounded-full">{order.status.replaceAll('_', ' ')} - {order.payment_status}</span><p className="text-xs font-bold">{order.item_quantity} items - {money.format(order.total_centavos / 100)}</p><button type="button" onClick={() => setActiveTab('Orders')} className="bg-emerald-100 text-[#006e00] font-bold text-xs px-4 py-1.5 rounded-lg">View Details</button></div>
            </div>)}</div>
          </div>
        </div>

        {/* Right Column (AI & Info) */}
        <div className="min-w-0 col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-gray-900">AI Recommendation For you</h3>
              <button
                onClick={() => setActiveTab?.('AI')}
                className="text-[11px] text-[#006e00] font-bold hover:underline"
              >
                View All →
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="border border-gray-200 rounded-xl p-3 text-center">
                <h4 className="text-xs font-bold text-gray-900">Bananas</h4>
                <p className="text-[11px] font-semibold text-gray-700">₱45.00 / kg</p>
                <button className="w-full bg-emerald-100 hover:bg-emerald-200 text-[#006e00] font-bold text-[10px] py-1 rounded mt-2 transition">
                  Add to Cart
                </button>
              </div>

              <div className="border border-gray-200 rounded-xl p-3 text-center">
                <h4 className="text-xs font-bold text-gray-900">Milk 1L</h4>
                <p className="text-[11px] font-semibold text-gray-700">₱75.00</p>
                <button className="w-full bg-emerald-100 hover:bg-emerald-200 text-[#006e00] font-bold text-[10px] py-1 rounded mt-2 transition">
                  Add to Cart
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 min-h-[160px]">
            <h3 className="text-sm font-bold text-[#006e00] mb-2">Why pick up in-store?</h3>
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