import { useState } from 'react';
import { Calendar, Clock, ShoppingBag, ArrowRight, ChevronDown, Inbox } from 'lucide-react';

export default function ShopperHistory() {
  const [activeFilter, setActiveFilter] = useState('All');

  const historyOrders = [
    {
      id: '0001234',
      date: 'july 28, 2026',
      time: '3:00 PM',
      paymentMethod: 'E-Wallet',
      status: 'Completed',
      total: '₱ 210.00',
      itemCount: 3,
      items: [
        { name: 'Bananas', qty: 'x1', image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=100&q=80' },
        { name: 'Milk', qty: 'x1', image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=100&q=80' },
        { name: 'Eggs', qty: 'x1', image: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=100&q=80' },
      ],
    },
  ];

  // 1. Filter orders array dynamically based on the active tab state
  const filteredOrders = historyOrders.filter((order) => {
    if (activeFilter === 'All') return true;
    return order.status.toLowerCase() === activeFilter.toLowerCase();
  });

  return (
    <div className="flex-1 bg-white min-h-screen p-6 font-sans flex flex-col justify-between">
      <div>
        {/* Title Header */}
        <div className="mb-6">
          <h1 className="text-sm font-bold text-black">History</h1>
          <p className="text-xs text-gray-600 mt-0.5">View your recent orders and transactions.</p>
        </div>

        {/* Filters and Dropdown Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-4">
          <div className="flex items-center gap-6">
            {['All', 'Completed', 'Processing', 'Cancelled'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`text-xs font-bold transition-colors relative pb-2 -mb-2 ${
                  activeFilter.toLowerCase() === filter.toLowerCase()
                    ? 'text-black border-b-2 border-[#006e00]'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <button className="border border-gray-300 rounded-lg px-2.5 py-1 flex items-center gap-2 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition">
            <Calendar className="w-3.5 h-3.5 text-gray-600" />
            <span>All Items</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
          </button>
        </div>

        {/* Order Cards Container */}
        <div className="max-w-5xl space-y-4">
          {filteredOrders.length > 0 ? (
            filteredOrders.map((order) => (
              <div
                key={order.id}
                className="border border-gray-300 rounded-xl p-4 bg-white flex items-center justify-between shadow-xs hover:border-gray-400 transition"
              >
                {/* Order Info Left */}
                <div className="flex items-center gap-4 border-r border-gray-200 pr-6">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-[#006e00] shrink-0">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-black">Order #{order.id}</h2>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-600 mt-1">
                      <Calendar className="w-3 h-3 text-gray-500" />
                      <span>{order.date} -</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-600 mt-0.5">
                      <Clock className="w-3 h-3 text-gray-500" />
                      <span>{order.time}</span>
                    </div>
                    <span className="inline-block bg-purple-50 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded mt-1.5 border border-purple-100">
                      {order.paymentMethod}
                    </span>
                  </div>
                </div>

                {/* Order Items Center */}
                <div className="flex-1 px-6">
                  <div className="flex items-center gap-3">
                    {order.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="border border-gray-200 rounded-lg p-1.5 bg-white relative w-14 h-14 flex items-center justify-center"
                      >
                        <img
                          src={item.image}
                          alt={item.name}
                          className="max-h-full max-w-full object-contain rounded"
                        />
                        <span className="absolute bottom-0.5 right-1 text-[10px] font-bold text-black">
                          {item.qty}
                        </span>
                      </div>
                    ))}
                  </div>
                  <span className="text-[11px] font-bold text-black block mt-1.5">
                    {order.itemCount} Items
                  </span>
                </div>

                {/* Order Status & Total Right */}
                <div className="text-right pl-6 shrink-0 space-y-1">
                  <span className="bg-emerald-100 text-[#006e00] text-[10px] font-bold px-2 py-0.5 rounded inline-block">
                    {order.status}
                  </span>
                  <span className="text-[10px] text-gray-500 block">Total</span>
                  <span className="text-sm font-extrabold text-black block">{order.total}</span>
                  <button className="border border-green-700 text-[#006e00] text-xs font-bold px-2.5 py-1 rounded-lg hover:bg-green-50 transition flex items-center gap-1 ml-auto mt-2">
                    View Details <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            /* 2. Empty State View when filtered list is empty */
            <div className="border border-dashed border-gray-300 rounded-xl p-12 text-center bg-gray-50/50">
              <Inbox className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-gray-600">No {activeFilter.toLowerCase()} orders found.</p>
            </div>
          )}
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex justify-end items-center gap-1 pt-6 max-w-5xl">
        <button className="border border-gray-300 rounded px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50">&lt;</button>
        <button className="bg-[#006e00] text-white rounded px-2.5 py-1 text-xs font-bold">1</button>
        <button className="border border-gray-300 rounded px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50">2</button>
        <button className="border border-gray-300 rounded px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50">3</button>
        <button className="border border-gray-300 rounded px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50">&gt;</button>
      </div>
    </div>
  );
}