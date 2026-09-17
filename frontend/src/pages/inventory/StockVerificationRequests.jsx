import { useState } from "react";
import InventoryLayout from "../../components/inventory/layout/InventoryLayout";
import StoreSelector from "../../components/inventory/layout/StoreSelector";
import VerificationDetailsModal from "../../components/inventory/stock-verification/VerificationDetailsModal";
import VerificationStatCards from "../../components/inventory/stock-verification/VerificationStatCards";
import VerificationTable from "../../components/inventory/stock-verification/VerificationTable";

const initialVerificationRequests = [
  { id: "SVR-2024-0523", requestedBy: "Mark Anthony", requesterInitials: "MA", requesterColor: "bg-blue-100 text-blue-700", product: "Premium Jasmine Rice", productInitials: "JR", productColor: "bg-amber-100 text-amber-800", size: "5 kg", sku: "RICE-0001", itemsToVerify: "8 bags", requestDate: "May 23, 2024", requestTime: "10:30 AM", priority: "High", status: "Pending", note: "Confirm the physical stock count and check for damaged bags." },
  { id: "SVR-2024-0522", requestedBy: "Ana Reyes", requesterInitials: "AR", requesterColor: "bg-purple-100 text-purple-700", product: "Argentina Corned Beef", productInitials: "CB", productColor: "bg-red-100 text-red-700", size: "175 g", sku: "CBEF-0002", itemsToVerify: "5 cans", requestDate: "May 23, 2024", requestTime: "09:45 AM", priority: "Medium", status: "Pending", note: "Verify the remaining canned goods after the latest delivery." },
  { id: "SVR-2024-0521", requestedBy: "Rex Caballero", requesterInitials: "RC", requesterColor: "bg-orange-100 text-orange-700", product: "Absolute Distilled Water", productInitials: "AW", productColor: "bg-cyan-100 text-cyan-700", size: "1.5 L", sku: "WTR-0003", itemsToVerify: "12 bottles", requestDate: "May 22, 2024", requestTime: "04:20 PM", priority: "Medium", status: "Pending", note: "Check the shelf and storage quantities for this product." },
  { id: "SVR-2024-0520", requestedBy: "Mark Anthony", requesterInitials: "MA", requesterColor: "bg-blue-100 text-blue-700", product: "Lucky Me Pancit Canton", productInitials: "LM", productColor: "bg-yellow-100 text-yellow-800", size: "60 g", sku: "NOD-0004", itemsToVerify: "6 packs", requestDate: "May 22, 2024", requestTime: "02:15 PM", priority: "Low", status: "Verified", note: "Physical quantity was confirmed and matched the recorded inventory." },
  { id: "SVR-2024-0519", requestedBy: "Jessa Manalo", requesterInitials: "JM", requesterColor: "bg-pink-100 text-pink-700", product: "Selecta Fortified Milk", productInitials: "FM", productColor: "bg-blue-100 text-blue-700", size: "1 L", sku: "MLK-0005", itemsToVerify: "7 cartons", requestDate: "May 21, 2024", requestTime: "11:00 AM", priority: "High", status: "Pending", note: "Inspect the expiry dates and verify the remaining cartons." },
  { id: "SVR-2024-0518", requestedBy: "Mark Anthony", requesterInitials: "MA", requesterColor: "bg-blue-100 text-blue-700", product: "Safeguard Soap", productInitials: "SS", productColor: "bg-sky-100 text-sky-700", size: "135 g", sku: "SOP-0006", itemsToVerify: "4 bars", requestDate: "May 20, 2024", requestTime: "03:30 PM", priority: "Low", status: "Verified", note: "The product quantity and condition were already confirmed." },
  { id: "SVR-2024-0517", requestedBy: "Ana Reyes", requesterInitials: "AR", requesterColor: "bg-purple-100 text-purple-700", product: "Tide Detergent Powder", productInitials: "TD", productColor: "bg-orange-100 text-orange-700", size: "1 kg", sku: "DET-0007", itemsToVerify: "10 packs", requestDate: "May 20, 2024", requestTime: "10:20 AM", priority: "Medium", status: "Pending", note: "Verify stock after the recent shelf replenishment." },
];

const requestTabs = [
  { label: "All Requests", status: "All" },
  { label: "Pending", status: "Pending" },
  { label: "Verified", status: "Verified" },
  { label: "Rejected", status: "Rejected" },
];

function StockVerificationRequests() {
  const [requests, setRequests] = useState(initialVerificationRequests);
  const [activeStatus, setActiveStatus] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [priorityFilter, setPriorityFilter] = useState("All Priorities");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState("");

  const filteredRequests = requests.filter((request) => {
    const searchableText = `${request.id} ${request.requestedBy} ${request.product} ${request.sku}`.toLowerCase();
    const matchesSearch = searchableText.includes(searchTerm.toLowerCase());
    const matchesTab = activeStatus === "All" || request.status === activeStatus;
    const matchesStatus = statusFilter === "All Statuses" || request.status === statusFilter;
    const matchesPriority = priorityFilter === "All Priorities" || request.priority === priorityFilter;

    return matchesSearch && matchesTab && matchesStatus && matchesPriority;
  });

  function getTabCount(status) {
    if (status === "All") return requests.length;
    return requests.filter((request) => request.status === status).length;
  }

  function updateRequestStatus(requestId, newStatus) {
    setRequests((currentRequests) =>
      currentRequests.map((request) =>
        request.id === requestId ? { ...request, status: newStatus } : request,
      ),
    );
    setSelectedRequest(null);
  }

  function refreshRequests() {
    setLastRefreshed(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }

  return (
    <InventoryLayout activePage="Stock Verification Requests">
      <div className="min-w-0 w-full">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stock Verification Requests</h1>
            <p className="mt-1 text-sm text-gray-500">Requests from supervisors to verify actual inventory and confirm stock status.</p>
          </div>
          <StoreSelector />
        </div>

        <VerificationStatCards requests={requests} />

        <div className="mt-5 overflow-x-auto border-b border-gray-200">
          <div className="flex min-w-max gap-7 px-1">
            {requestTabs.map((tab) => (
              <button key={tab.status} type="button" onClick={() => setActiveStatus(tab.status)} className={`border-b-2 px-1 py-3 text-xs font-medium ${activeStatus === tab.status ? "border-green-700 text-green-700" : "border-transparent text-gray-600 hover:text-gray-900"}`}>
                {tab.label} ({getTabCount(tab.status)})
              </button>
            ))}
          </div>
        </div>

        <section aria-label="Verification filters" className="my-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(260px,1.5fr)_minmax(150px,0.7fr)_minmax(150px,0.7fr)]">
            <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by request ID, product, or supervisor..." className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100" />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600 outline-none focus:border-green-600">
              <option>All Statuses</option>
              <option>Pending</option>
              <option>Verified</option>
              <option>Rejected</option>
            </select>
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600 outline-none focus:border-green-600">
              <option>All Priorities</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-3 lg:justify-end">
            {lastRefreshed && <span className="text-[11px] text-gray-400">Refreshed {lastRefreshed}</span>}
            <button type="button" onClick={refreshRequests} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Refresh</button>
          </div>
        </section>

        <VerificationTable requests={filteredRequests} onViewDetails={setSelectedRequest} />
      </div>

      {selectedRequest && (
        <VerificationDetailsModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onUpdateStatus={updateRequestStatus}
        />
      )}
    </InventoryLayout>
  );
}

export default StockVerificationRequests;
