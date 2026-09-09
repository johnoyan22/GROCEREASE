import { Bell } from 'lucide-react';

export default function ShopperNotifications() {
  const notifications = [
    {
      id: 1,
      title: 'Payment Successful (Cash on pick up)',
      description: 'Your payment for Order #0001234 has been received successfully. Please bring the exact amount when you pick up your order.',
      date: 'July 28, 2026',
      time: '4:55 PM',
      unread: true,
    },
    {
      id: 2,
      title: 'Payment Successful (Debit Card)',
      description: 'Your debit card payment for Order #0001234 has been processed successfully. Thank you for shopping with GrocerEase!',
      date: 'July 28, 2026',
      time: '4:55 PM',
      unread: true,
    },
    {
      id: 3,
      title: 'Payment Successful ( E-Wallet)',
      description: 'Your e-wallet payment for Order #0001234 has been received successfully. Thank you for shopping with GrocerEase!',
      date: 'July 28, 2026',
      time: '4:55 PM',
      unread: true,
    },
    {
      id: 4,
      title: 'Order Received',
      description: 'We have received your order #0001234. You will be notified once an inventory worker is assigned to your order.',
      date: 'July 28, 2026',
      time: '4:55 PM',
      unread: true,
    },
    {
      id: 5,
      title: 'Order Received',
      description: 'We have received your order #0001234. You will be notified once an inventory worker is assigned to your order.',
      date: 'July 28, 2026',
      time: '4:55 PM',
      unread: true,
    },
  ];

  return (
    <div className="flex-1 bg-white min-h-screen p-6 font-sans">
      {/* Title Header */}
      <div className="mb-6">
        <h1 className="text-sm font-bold text-black">Notifications</h1>
        <p className="text-xs text-gray-600 mt-0.5">Stay update with your latest activities and order status.</p>
      </div>

      {/* Notifications Cards Container */}
      <div className="max-w-4xl space-y-3">
        {notifications.map((item) => (
          <div
            key={item.id}
            className="border border-gray-300 rounded-xl p-4 flex items-start justify-between bg-white shadow-xs hover:border-gray-400 transition"
          >
            {/* Left Content */}
            <div className="flex items-start gap-4">
              <div className="p-2 border border-gray-300 rounded-lg text-black bg-white shrink-0 mt-0.5">
                <Bell className="w-5 h-5 stroke-[1.5]" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-black">{item.title}</h2>
                <p className="text-[11px] text-gray-600 mt-1 leading-relaxed max-w-xl">
                  {item.description}
                </p>
              </div>
            </div>

            {/* Right Date and Status Indicator */}
            <div className="flex items-center gap-2 shrink-0 text-right">
              <div>
                <span className="text-[10px] text-gray-500 block">{item.date}</span>
                <span className="text-[10px] text-gray-500 block font-medium">{item.time}</span>
              </div>
              {item.unread && (
                <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block ml-1"></span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}