import { StockUpdateIcon, VerificationIcon } from "../shared/InventoryIcons";

const recentActivities = [
  {
    activity: "Stock update submitted",
    details: "Updated stock for 8 items",
    referenceId: "SU-2026-0223",
    dateTime: "Sep 11, 2026, 10:02 AM",
    status: "Pending",
    statusColor: "bg-amber-50 text-amber-700",
    icon: <StockUpdateIcon />,
    iconColor: "bg-blue-50 text-blue-700",
  },
  {
    activity: "Stock verification confirmed",
    details: "Confirmed actual stock for 5 items",
    referenceId: "SV-2026-0520",
    dateTime: "Sep 11, 2026, 9:45 AM",
    status: "Completed",
    statusColor: "bg-green-50 text-green-700",
    icon: <VerificationIcon />,
    iconColor: "bg-green-50 text-green-700",
  },
];

function RecentActivity() {
  return (
    <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Recent Activity</h2>
        <button type="button" className="text-xs font-medium text-green-700 hover:text-green-800">
          View all
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-xs">
          <thead className="border-b border-gray-200 text-gray-500">
            <tr>
              <th scope="col" className="px-3 py-3 font-medium">Activity</th>
              <th scope="col" className="px-3 py-3 font-medium">Details</th>
              <th scope="col" className="px-3 py-3 font-medium">Reference ID</th>
              <th scope="col" className="px-3 py-3 font-medium">Date &amp; Time</th>
              <th scope="col" className="px-3 py-3 font-medium">Status</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 text-gray-700">
            {recentActivities.map((activity) => (
              <tr key={activity.referenceId}>
                <td className="px-3 py-3 font-medium text-gray-800">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${activity.iconColor}`}
                    >
                      {activity.icon}
                    </span>
                    <span>{activity.activity}</span>
                  </div>
                </td>
                <td className="px-3 py-3">{activity.details}</td>
                <td className="px-3 py-3">{activity.referenceId}</td>
                <td className="px-3 py-3 whitespace-nowrap">{activity.dateTime}</td>
                <td className="px-3 py-3">
                  <span className={`rounded-md px-2 py-1 text-[11px] font-medium ${activity.statusColor}`}>
                    {activity.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default RecentActivity;
