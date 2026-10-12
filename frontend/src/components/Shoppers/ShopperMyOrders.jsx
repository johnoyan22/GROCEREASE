import { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, ArrowRight, ShoppingBag } from 'lucide-react';

export default function ShopperMyOrders() {
  const [activeTab, setActiveTab] = useState('All Orders');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
        const response = await axios.get(`${apiUrl}/orders`);
        setOrders(response.data.data || response.data);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch orders:", err);
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const handlePayOrder = async (orderId) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
      await axios.put(`${apiUrl}/orders/${orderId}/pay`);
      alert("Order paid successfully!");
      
      // Re-fetch orders to update the list view
      const response = await axios.get(`${apiUrl}/orders`);
      setOrders(response.data.data || response.data);
    } catch (err) {
      console.error("Failed to process payment:", err);
      alert("Error processing payment.");
    }
  };

  const filteredOrders = activeTab === 'All Orders' 
    ? orders 
    : orders.filter(order => (order.status || '').toLowerCase() === activeTab.toLowerCase());

  const getTabCount = (tabName) => {
    if (tabName === 'All Orders') return null;
    return orders.filter(order => (order.status || '').toLowerCase() === tabName.toLowerCase()).length;
  };

  const tabs = ['All Orders', 'To pay', 'Processing', 'Successful', 'Cancelled'];

  if (loading) {
    return <div className="flex-1 p-10 text-center text-xs text-gray-500 bg-white">Loading your orders from database...</div>;
  }

  return (
    <div className="flex-1 bg-white min-h-screen p-6 font-sans">
      <div className="mb-4">
        <h1 className="text-sm font-bold text-black">My Orders</h1>
        <p className="text-xs text-gray-600 mt-0.5">Track, View and reorder your purchases.</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-6 border-b border-gray-300 pb-2 mb-4 text-xs font-bold">
        {tabs.map((tabName) => {
          const count = getTabCount(tabName);
          return (
            <button
              key={tabName}
              onClick={() => setActiveTab(tabName)}
              className={`flex items-center gap-1 relative pb-1 transition ${
                activeTab === tabName ? 'text-[#006e00]' : 'text-gray-700 hover:text-black'
              }`}
            >
              <span>{tabName}</span>
              {count !== null && count > 0 && (
                <span className="bg-gray-200 text-black text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {count}
                </span>
              )}
              {activeTab === tabName && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#006e00]"></span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mb-3">
        <h2 className="text-xs font-bold text-black">Current Orders ({activeTab})</h2>
        <p className="text-[11px] text-gray-500">
          {activeTab === 'To pay' ? 'Complete your purchase before the order expires' : `Showing your ${activeTab.toLowerCase()} orders.`}
        </p>
      </div>

      {/* Order Cards List or Empty State */}
      <div className="space-y-4">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order) => {
            const orderId = order.order_id || order.id;
            const orderTotal = Number(order.total) || 0;
            const orderDate = order.created_at ? new Date(order.created_at).toLocaleDateString() : 'Recent';
            const orderItems = order.items || [];

            return (
              <div key={orderId} className="border border-gray-300 rounded-xl p-4 flex items-center justify-between bg-white shadow-sm">
                <div className="flex items-center gap-6">
                  <div>
                    <h3 className="text-sm font-bold text-black">Order #{orderId}</h3>
                    <div className="flex items-center gap-1 text-[11px] text-gray-600 mt-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-500" />
                      <span>{orderDate} · {orderItems.length} Items</span>
                    </div>
                  </div>

                  {/* Items Thumbnails */}
                  <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
                    {orderItems.map((item, idx) => (
                      <div key={idx} className="relative border border-green-200 rounded-lg p-1 w-12 h-12 flex items-center justify-center bg-white">
                        <img src={item.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=150&q=80'} alt={item.name} className="max-h-full max-w-full object-contain" />
                        <span className="absolute bottom-0.5 right-1 text-[10px] font-bold text-black">
                          x{item.quantity || item.qty}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-6 border-l border-gray-300 pl-6">
                  <div>
                    <span className="text-[10px] font-bold text-gray-600 block">Total</span>
                    <span className="text-xs font-black text-black">₱ {orderTotal.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
                      {order.status || 'To pay'}
                    </span>
                    {(order.status === 'To pay' || !order.status) && (
                      <button 
                        onClick={() => handlePayOrder(orderId)}
                        className="bg-[#006e00] text-white text-xs font-bold px-4 py-1.5 rounded-lg hover:bg-green-800 transition flex items-center gap-1"
                      >
                        Checkout <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="border border-dashed border-gray-300 rounded-xl p-12 text-center bg-gray-50/50">
            <ShoppingBag className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-gray-600">No orders found in "{activeTab}".</p>
          </div>
        )}
      </div>
    </div>
  );
}