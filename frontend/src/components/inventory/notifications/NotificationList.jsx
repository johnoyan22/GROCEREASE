const priorityStyles = {
  Important: "bg-red-50 text-red-600",
  High: "bg-orange-50 text-orange-700",
  Medium: "bg-yellow-50 text-yellow-700",
  Low: "bg-green-50 text-green-700",
};

function NotificationList({ notifications, expandedId, onToggle }) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="divide-y divide-gray-100">
        {notifications.map((notification) => (
          <article key={notification.id} className={notification.isRead ? "bg-white" : "bg-blue-50/30"}>
            <button type="button" onClick={() => onToggle(notification.id)} className="flex w-full items-center gap-3 px-4 py-4 text-left sm:gap-4">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${notification.dotColor}`} />
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-bold ${notification.iconColor}`}>{notification.icon}</span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm text-gray-900 ${notification.isRead ? "font-normal" : "font-semibold"}`}>{notification.message}</span>
                <span className="mt-1 block text-xs text-gray-500">{notification.sender} · {notification.date}</span>
                {expandedId === notification.id && <span className="mt-3 block rounded-lg bg-gray-50 p-3 text-xs leading-5 text-gray-600">{notification.details}</span>}
              </span>
              <span className={`hidden rounded-md px-3 py-1 text-[10px] font-medium sm:block ${priorityStyles[notification.priority]}`}>{notification.priority}</span>
              <span className="text-gray-400">{expandedId === notification.id ? "-" : "+"}</span>
            </button>
          </article>
        ))}
      </div>

      {notifications.length === 0 && <div className="px-4 py-12 text-center"><p className="font-medium text-gray-700">No notifications found</p><p className="mt-1 text-xs text-gray-500">There are no notifications in this category.</p></div>}

      <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <p>Showing {notifications.length} notification{notifications.length === 1 ? "" : "s"}</p>
        <div className="flex items-center gap-2"><button type="button" disabled className="rounded-md border border-gray-200 px-3 py-2 disabled:opacity-40">Previous</button><button type="button" className="rounded-md bg-green-700 px-3 py-2 text-white">1</button><button type="button" disabled className="rounded-md border border-gray-200 px-3 py-2 disabled:opacity-40">Next</button></div>
        <select aria-label="Notifications per page" className="rounded-md border border-gray-200 bg-white px-3 py-2"><option>10/page</option><option>25/page</option></select>
      </div>
    </section>
  );
}

export default NotificationList;
