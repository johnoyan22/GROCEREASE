import { useState } from "react";
import ActivityLogTable from "../../components/inventory/activity-log/ActivityLogTable";
import InventoryLayout from "../../components/inventory/layout/InventoryLayout";
import StoreSelector from "../../components/inventory/layout/StoreSelector";

const initialActivities = [
  { id: 1, date: "May 23, 2024", time: "10:30 AM", activity: "Submitted Stock Update", activityColor: "text-green-700", details: "Updated 3 products", subdetails: "Premium Jasmine Rice, Argentina Corned Beef, Absolute Water", module: "Stock Management", moduleColor: "bg-green-50 text-green-700", performedBy: "Juan Dela Cruz", initials: "JD", role: "Inventory Worker", userColor: "bg-amber-100 text-amber-800", ipAddress: "192.168.1.10" },
  { id: 2, date: "May 23, 2024", time: "09:45 AM", activity: "Verified Stock Request", activityColor: "text-blue-700", details: "Request ID: SVR-2024-0523", subdetails: "Approved", module: "Stock Verification", moduleColor: "bg-blue-50 text-blue-700", performedBy: "Maria Santos", initials: "MS", role: "Supervisor", userColor: "bg-purple-100 text-purple-700", ipAddress: "192.168.1.11" },
  { id: 3, date: "May 22, 2024", time: "04:15 PM", activity: "Updated Stock Quantity", activityColor: "text-green-700", details: "Premium Jasmine Rice", subdetails: "120 to 115 units", module: "Stock Management", moduleColor: "bg-green-50 text-green-700", performedBy: "Juan Dela Cruz", initials: "JD", role: "Inventory Worker", userColor: "bg-amber-100 text-amber-800", ipAddress: "192.168.1.10" },
  { id: 4, date: "May 22, 2024", time: "02:30 PM", activity: "Updated Stock Quantity", activityColor: "text-green-700", details: "Absolute Distilled Water", subdetails: "10 to 8 units", module: "Stock Management", moduleColor: "bg-green-50 text-green-700", performedBy: "Ann Reyes", initials: "AR", role: "Inventory Worker", userColor: "bg-pink-100 text-pink-700", ipAddress: "192.168.1.12" },
  { id: 5, date: "May 22, 2024", time: "11:00 AM", activity: "Submitted Stock Update", activityColor: "text-green-700", details: "Updated 5 products", module: "Stock Management", moduleColor: "bg-green-50 text-green-700", performedBy: "Rex Caballero", initials: "RC", role: "Inventory Worker", userColor: "bg-orange-100 text-orange-700", ipAddress: "192.168.1.13" },
  { id: 6, date: "May 21, 2024", time: "05:20 PM", activity: "Viewed Low Stock Items", activityColor: "text-purple-700", details: "Viewed 24 items", module: "Low Stock Monitoring", moduleColor: "bg-purple-50 text-purple-700", performedBy: "Maria Santos", initials: "MS", role: "Supervisor", userColor: "bg-purple-100 text-purple-700", ipAddress: "192.168.1.11" },
  { id: 7, date: "May 21, 2024", time: "03:40 PM", activity: "Verified Stock Request", activityColor: "text-blue-700", details: "Request ID: SVR-2024-0518", subdetails: "Approved", module: "Stock Verification", moduleColor: "bg-blue-50 text-blue-700", performedBy: "Maria Santos", initials: "MS", role: "Supervisor", userColor: "bg-purple-100 text-purple-700", ipAddress: "192.168.1.11" },
  { id: 8, date: "May 20, 2024", time: "03:30 PM", activity: "Updated Stock Quantity", activityColor: "text-green-700", details: "Argentina Corned Beef", subdetails: "22 to 18 units", module: "Stock Management", moduleColor: "bg-green-50 text-green-700", performedBy: "Juan Dela Cruz", initials: "JD", role: "Inventory Worker", userColor: "bg-amber-100 text-amber-800", ipAddress: "192.168.1.10" },
  { id: 9, date: "May 20, 2024", time: "10:20 AM", activity: "Submitted Stock Update", activityColor: "text-green-700", details: "Updated 4 products", module: "Stock Management", moduleColor: "bg-green-50 text-green-700", performedBy: "Rex Caballero", initials: "RC", role: "Inventory Worker", userColor: "bg-orange-100 text-orange-700", ipAddress: "192.168.1.13" },
  { id: 10, date: "May 19, 2024", time: "06:00 PM", activity: "Login", activityColor: "text-gray-700", details: "Logged in to the system", module: "System", moduleColor: "bg-gray-100 text-gray-700", performedBy: "Juan Dela Cruz", initials: "JD", role: "Inventory Worker", userColor: "bg-amber-100 text-amber-800", ipAddress: "192.168.1.10" },
];

function ActivityLog() {
  const [fromDate, setFromDate] = useState("2024-05-19");
  const [toDate, setToDate] = useState("2024-05-23");
  const [activityFilter, setActivityFilter] = useState("All Activities");
  const [moduleFilter, setModuleFilter] = useState("All Modules");
  const [userFilter, setUserFilter] = useState("All Users");

  const activities = [...new Set(initialActivities.map((item) => item.activity))];
  const modules = [...new Set(initialActivities.map((item) => item.module))];
  const users = [...new Set(initialActivities.map((item) => item.performedBy))];
  const filteredActivities = initialActivities.filter((item) => {
    const activityDate = new Date(item.date);
    const startsOnOrAfter = !fromDate || activityDate >= new Date(`${fromDate}T00:00:00`);
    const endsOnOrBefore = !toDate || activityDate <= new Date(`${toDate}T23:59:59`);

    return startsOnOrAfter
      && endsOnOrBefore
      && (activityFilter === "All Activities" || item.activity === activityFilter)
      && (moduleFilter === "All Modules" || item.module === moduleFilter)
      && (userFilter === "All Users" || item.performedBy === userFilter);
  });

  function exportActivityLog() {
    const headings = ["Date", "Time", "Activity", "Details", "Module", "Performed By", "Role", "IP Address"];
    const rows = filteredActivities.map((item) => [item.date, item.time, item.activity, item.details, item.module, item.performedBy, item.role, item.ipAddress]);
    const csv = [headings, ...rows].map((row) => row.map((value) => `"${value}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "grocerease-activity-log.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <InventoryLayout activePage="Activity Log">
      <div className="min-w-0 w-full">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div><h1 className="text-2xl font-bold text-gray-900">Activity Log</h1><p className="mt-1 text-sm text-gray-500">View your recent activities and all actions performed in the system.</p></div>
          <StoreSelector />
        </div>

        <section aria-label="Activity filters" className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <input aria-label="Activity start date" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600" />
            <input aria-label="Activity end date" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600" />
            <select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600"><option>All Activities</option>{activities.map((activity) => <option key={activity}>{activity}</option>)}</select>
            <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600"><option>All Modules</option>{modules.map((module) => <option key={module}>{module}</option>)}</select>
            <select value={userFilter} onChange={(event) => setUserFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600"><option>All Users</option>{users.map((user) => <option key={user}>{user}</option>)}</select>
          </div>
          <button type="button" onClick={exportActivityLog} className="rounded-lg border border-green-600 bg-white px-5 py-2.5 text-sm font-medium text-green-700 hover:bg-green-50">Export</button>
        </section>

        <ActivityLogTable activities={filteredActivities} />
      </div>
    </InventoryLayout>
  );
}

export default ActivityLog;
