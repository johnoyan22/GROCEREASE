function ActivityLogTable({ activities }) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
            <tr><th className="px-4 py-3 font-medium">Date &amp; Time</th><th className="px-4 py-3 font-medium">Activity</th><th className="px-4 py-3 font-medium">Details</th><th className="px-4 py-3 font-medium">Module</th><th className="px-4 py-3 font-medium">Performed By</th><th className="px-4 py-3 font-medium">IP Address</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {activities.map((activity) => (
              <tr key={activity.id} className="hover:bg-gray-50/70">
                <td className="whitespace-nowrap px-4 py-3"><p>{activity.date}</p><p className="text-[10px] text-gray-500">{activity.time}</p></td>
                <td className={`px-4 py-3 font-medium ${activity.activityColor}`}>{activity.activity}</td>
                <td className="max-w-xs px-4 py-3"><p>{activity.details}</p>{activity.subdetails && <p className="mt-1 text-[10px] text-gray-500">{activity.subdetails}</p>}</td>
                <td className="px-4 py-3"><span className={`whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-medium ${activity.moduleColor}`}>{activity.module}</span></td>
                <td className="px-4 py-3"><div className="flex items-center gap-2"><span className={`flex h-8 w-8 items-center justify-center rounded-full text-[9px] font-bold ${activity.userColor}`}>{activity.initials}</span><div><p className="font-medium text-gray-900">{activity.performedBy}</p><p className="text-[10px] text-gray-500">{activity.role}</p></div></div></td>
                <td className="whitespace-nowrap px-4 py-3">{activity.ipAddress}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activities.length === 0 && <div className="px-4 py-12 text-center"><p className="font-medium text-gray-700">No activities found</p><p className="mt-1 text-xs text-gray-500">Try changing the selected filters.</p></div>}

      <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <p>Showing {activities.length} activit{activities.length === 1 ? "y" : "ies"}</p>
        <div className="flex items-center gap-2"><button type="button" disabled className="rounded-md border border-gray-200 px-3 py-2 disabled:opacity-40">Previous</button><button type="button" className="rounded-md bg-green-700 px-3 py-2 text-white">1</button><button type="button" disabled className="rounded-md border border-gray-200 px-3 py-2 disabled:opacity-40">Next</button></div>
        <select aria-label="Activities per page" className="rounded-md border border-gray-200 bg-white px-3 py-2"><option>10/page</option><option>25/page</option><option>50/page</option></select>
      </div>
    </section>
  );
}

export default ActivityLogTable;
