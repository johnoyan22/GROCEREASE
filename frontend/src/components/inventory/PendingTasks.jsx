const pendingTasks = [
    {
        title: "Stock Verificattion Requests",
        description: "Requests that need inventory checking",
        count: "7 pending",
        color: "bg-blue-50 text-blue-600",
        icon: ""
    },
    {
        title: "Low Stock Alerts",
        description: "Items that may need restocking soon.",
        count: "18 alerts",
        color: "bg-orange-50 text-orange-600",
        icon: ""
  },
  {
        title: "Stock Updates",
        description: "Submitted updates waiting for review.",
        count: "12 updates",
        color: "bg-green-50 text-green-600",
        icon: ""
  },
]

function PendingTasks() {
    return(
        <section className="mt-5 rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-800">Pending Task</h2>
                <button className="text-xs font-medium hover:text-green-700 hover:font-bold" >View all tasks</button>
            </div>

            <div className="divide-y divide-gray-100">
                {pendingTasks.map((task) => (
                    <div key={task.title} className="flex items-center justify-between gap-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${task.color}`}>
                            !
                            </div>

                            <div>
                                <p className="text-sm font-medium text-gray-800">{task.title}</p>
                                <p className="text-xs text-gray-500">{task.description}</p>
                            </div>
                        </div>
                        <span className={`shrink-0 rounded-md px-2 py-1 text-xs text-gray-600 ${task.color}`}>{task.count}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}

export default PendingTasks;