import { ShoppingCart, ShoppingBag } from 'lucide-react';
import Logo from '../../assets/images/Logo.png';

function ShopperMainContent({ setActiveTab }) {
  return (
    <main className="flex-1 overflow-y-auto p-8 bg-gray-50">
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-gray-900">Good morning, Shopper!</h1>
        <p className="text-xs text-gray-500">Ready for a fresh day</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Column (Stats & Active Orders) */}
        <div className="col-span-8 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                <ShoppingCart className="w-5 h-5 text-[#006e00]" />
              </div>
              <div>
                <span className="text-2xl font-bold text-black">3</span>
                <p className="text-[11px] text-gray-500">Items in Cart</p>
                <button 
                  onClick={() => setActiveTab?.('Browse')} 
                  className="text-[11px] text-[#006e00] font-bold hover:underline"
                >
                  View Cart →
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                <span className="text-lg font-bold text-[#006e00]">₱</span>
              </div>
              <div>
                <span className="text-2xl font-bold text-black">₱210.00</span>
                <p className="text-[11px] text-gray-500">Cart total</p>
                <button 
                  onClick={() => setActiveTab?.('Browse')} 
                  className="text-[11px] text-[#006e00] font-bold hover:underline"
                >
                  View Cart →
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                <ShoppingBag className="w-5 h-5 text-[#006e00]" />
              </div>
              <div>
                <span className="text-2xl font-bold text-black">3</span>
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
          <div className="bg-white border border-gray-200 rounded-2xl p-6 flex items-center justify-between relative overflow-hidden">
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
              className="w-40 h-40 object-contain"
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

            <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold text-black">#ORD-0001234</span>
                <p className="text-[11px] text-gray-500">July 29, 2026</p>
              </div>

              <div className="text-right space-y-2">
                <span className="inline-block bg-emerald-100 text-[#006e00] text-[10px] font-bold px-3 py-1 rounded-full">
                  To pay
                </span>
                <p className="text-xs font-bold text-gray-800">3 Items — ₱ 210.00</p>
                <button 
                  onClick={() => setActiveTab?.('Orders')} 
                  className="bg-emerald-100 hover:bg-emerald-200 text-[#006e00] font-bold text-xs px-4 py-1.5 rounded-lg transition"
                >
                  View Details
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (AI & Info) */}
        <div className="col-span-4 space-y-6">
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