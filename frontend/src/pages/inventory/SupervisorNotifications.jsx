import { useState } from "react";
import InventoryLayout from "../../components/inventory/layout/InventoryLayout";
import StoreSelector from "../../components/inventory/layout/StoreSelector";
import NotificationList from "../../components/inventory/notifications/NotificationList";

const initialNotifications = [
  { id: 1, message: "Please prioritize verifying the stock for the canned goods section.", sender: "Mark Anthony", date: "May 23, 2024 10:30 AM", priority: "Important", isRead: false, icon: "!", iconColor: "bg-red-50 text-red-600", dotColor: "bg-red-500", details: "Complete the assigned verification before the afternoon inventory review." },
  { id: 2, message: "Stock verification request SVR-2024-0523 has been assigned to you.", sender: "Mark Anthony", date: "May 23, 2024 09:45 AM", priority: "Medium", isRead: false, icon: "V", iconColor: "bg-orange-50 text-orange-700", dotColor: "bg-orange-500", details: "Verify eight bags of Premium Jasmine Rice and submit the actual count." },
  { id: 3, message: "Please update the stock for dairy items today.", sender: "Mark Anthony", date: "May 22, 2024 04:15 PM", priority: "Medium", isRead: false, icon: "S", iconColor: "bg-blue-50 text-blue-700", dotColor: "bg-blue-500", details: "Check milk products in both the display refrigerator and storage room." },
  { id: 4, message: "Great job on the recent stock updates! Keep it up.", sender: "Ana Reyes", date: "May 22, 2024 10:20 AM", priority: "Low", isRead: true, icon: "OK", iconColor: "bg-green-50 text-green-700", dotColor: "bg-green-600", details: "The last submitted quantities were reviewed and approved." },
  { id: 5, message: "Reminder: Submit daily stock update before 6 PM.", sender: "Rex Caballero", date: "May 21, 2024 09:00 AM", priority: "Important", isRead: true, icon: "R", iconColor: "bg-purple-50 text-purple-700", dotColor: "bg-purple-500", details: "Include all products counted during your assigned shift." },
  { id: 6, message: "Low stock alert: Selecta Fortified Milk has 3 units remaining.", sender: "System", date: "May 21, 2024 08:45 AM", priority: "High", isRead: true, icon: "L", iconColor: "bg-orange-50 text-orange-700", dotColor: "bg-orange-500", details: "The current quantity is below the configured reorder level." },
];

function SupervisorNotifications() {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [activeTab, setActiveTab] = useState("All");
  const [expandedId, setExpandedId] = useState(null);

  const filteredNotifications = notifications.filter((notification) => {
    if (activeTab === "Unread") return !notification.isRead;
    if (activeTab === "Important") return notification.priority === "Important";
    return true;
  });

  function toggleNotification(notificationId) {
    setExpandedId((currentId) => currentId === notificationId ? null : notificationId);
    setNotifications((currentNotifications) => currentNotifications.map((notification) => notification.id === notificationId ? { ...notification, isRead: true } : notification));
  }

  function markAllAsRead() {
    setNotifications((currentNotifications) => currentNotifications.map((notification) => ({ ...notification, isRead: true })));
  }

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;
  const importantCount = notifications.filter((notification) => notification.priority === "Important").length;

  return (
    <InventoryLayout activePage="Supervisor Notification">
      <div className="min-w-0 w-full">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div><h1 className="text-2xl font-bold text-gray-900">Supervisor Notification</h1><p className="mt-1 text-sm text-gray-500">Messages and notifications from your supervisor.</p></div>
          <StoreSelector />
        </div>

        <div className="mb-4 flex flex-col gap-3 border-b border-gray-200 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-7">
            {[{ label: "All", count: notifications.length }, { label: "Unread", count: unreadCount }, { label: "Important", count: importantCount }].map((tab) => (
              <button key={tab.label} type="button" onClick={() => setActiveTab(tab.label)} className={`border-b-2 px-1 py-3 text-xs font-medium ${activeTab === tab.label ? "border-green-700 text-green-700" : "border-transparent text-gray-600"}`}>{tab.label} ({tab.count})</button>
            ))}
          </div>
          <button type="button" onClick={markAllAsRead} disabled={unreadCount === 0} className="mb-2 self-start rounded-lg px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:text-gray-400">Mark all as read</button>
        </div>

        <NotificationList notifications={filteredNotifications} expandedId={expandedId} onToggle={toggleNotification} />
      </div>
    </InventoryLayout>
  );
}

export default SupervisorNotifications;
