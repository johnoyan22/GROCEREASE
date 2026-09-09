const updates = [
    {
        action: "Your stock update for \"Pancit Canton 60\" ",
        description: "has been approved",
        count: "7 pending",
        color: "bg-blue-50 text-blue-600",
        time: "10:02AM",
        icon: ""
    },
    {
        action: "Low Stock Alerts",
        description: "Items that may need restocking soon.",
        count: "18 alerts",
        color: "bg-orange-50 text-orange-600",
        time: "09::32AM",
        icon: ""
  },
  {
        action: "Stock Updates",
        description: "Submitted updates waiting for review.",
        count: "12 updates",
        color: "bg-green-50 text-green-600",
        time: "3:42PM",
        icon: ""
  },
]
function RecentUpdates() {
    return(
        <section className="mt-5 rounded-xl bg-white p-5">
            <div className="mb-2 flex items-center justify-between">
                <h2 className="text-base font-semibolld text-gray-800">Recent Notifications</h2>
                <button className="text-xs font-medium hover:text-green-800 hover:font-bold">View all</button>
            </div>

            <div>
                {updates.map((notification) => (
                    <div key={notification.action} className="flex items-center justify-between gap-4 py-3">
                        <div className="flex min-w-0 items-center gap-4">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${notification.color}`}>
                                !
                            </div>
                        
                            <div>
                                <p className="text-sm font-medium text-gray-800">{notification.action}</p>
                                <p className="text-xs text-gray-500">{notification.description}</p>
                            </div>
                        </div>
                        
                    <span className="px-2 py-1 text-sm text-gray-600">{notification.time}</span>
                    </div>
                    
                ))}

            </div>

        </section>
    );
}

export default RecentUpdates;