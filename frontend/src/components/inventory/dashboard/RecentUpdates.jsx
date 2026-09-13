import { LowStockIcon, StockUpdateIcon, VerificationIcon } from "../shared/InventoryIcons";

const updates = [
    {
        action: "Your stock update for \"Pancit Canton 60\" ",
        description: "has been approved",
        time: "10:02 AM",
        icon: <StockUpdateIcon />,
        iconColor: "bg-green-50 text-green-700",
    },
    {
        action: "New stock verification request received",
        description: "from supervisor.",
        time: "9:32 AM",
        icon: <VerificationIcon />,
        iconColor: "bg-blue-50 text-blue-700",
  },
  {
        action: "Restock \"Evaporada 370ml\"",
        description: "current stock running low",
        time: "3:42 PM",
        icon: <LowStockIcon />,
        iconColor: "bg-orange-50 text-orange-700",
  },
  {
        action: "Stock update request.",
        description: "Status: Approved",
        time: "2:03 PM",
        icon: <VerificationIcon />,
        iconColor: "bg-purple-50 text-purple-700",
  },
]
function RecentUpdates() {
    return(
        <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-2 flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-800">Recent Notifications</h2>
                <button type="button" className="text-xs font-medium text-green-700 hover:text-green-800">
                    View all
                </button>
            </div>

            <div className="divide-y divide-gray-100">
                {updates.map((notification) => (
                    <div key={notification.action} className="flex items-center justify-between gap-4 py-3">
                        <div className="flex min-w-0 items-center gap-4">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${notification.iconColor}`}
                            >
                                {notification.icon}
                            </div>
                        
                            <div>
                                <p className="text-sm font-medium text-gray-800">{notification.action}</p>
                                <p className="text-xs text-gray-500">{notification.description}</p>
                            </div>
                        </div>
                        
                    <span className="shrink-0 text-xs text-gray-500">{notification.time}</span>
                    </div>
                ))}
            </div>

        </section>
    );
}

export default RecentUpdates;
