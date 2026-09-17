import { useState } from "react";
import InventoryLayout from "../../components/inventory/layout/InventoryLayout";
import StoreSelector from "../../components/inventory/layout/StoreSelector";
import StockStatCards from "../../components/inventory/stock-management/StockStatCards";
import StockTable from "../../components/inventory/stock-management/StockTable";
import StockUpdateModal from "../../components/inventory/stock-management/StockUpdateModal";

const initialStockItems = [
  { id: 1, name: "Premium Jasmine Rice", size: "5 kg", sku: "RICE-0001", barcode: "4801234567890", category: "Staples", stock: 120, reorderLevel: 20, lastUpdated: "May 23, 2024", updateTime: "10:30 AM", thumbnail: "JR", thumbnailColor: "bg-amber-100 text-amber-800" },
  { id: 2, name: "Argentina Corned Beef", size: "175 g", sku: "CBEF-0002", barcode: "4801234567891", category: "Canned Goods", stock: 18, reorderLevel: 20, lastUpdated: "May 23, 2024", updateTime: "09:45 AM", thumbnail: "CB", thumbnailColor: "bg-red-100 text-red-700" },
  { id: 3, name: "Absolute Distilled Water", size: "1.5 L", sku: "WTR-0003", barcode: "4801234567892", category: "Beverages", stock: 200, reorderLevel: 20, lastUpdated: "May 22, 2024", updateTime: "04:15 PM", thumbnail: "AW", thumbnailColor: "bg-cyan-100 text-cyan-700" },
  { id: 4, name: "Lucky Me Pancit Canton", size: "60 g", sku: "NOD-0004", barcode: "4801234567893", category: "Noodles", stock: 8, reorderLevel: 20, lastUpdated: "May 22, 2024", updateTime: "02:30 PM", thumbnail: "LM", thumbnailColor: "bg-yellow-100 text-yellow-800" },
  { id: 5, name: "Selecta Fortified Milk", size: "1 L", sku: "MLK-0005", barcode: "4801234567894", category: "Dairy", stock: 0, reorderLevel: 20, lastUpdated: "May 22, 2024", updateTime: "11:10 AM", thumbnail: "FM", thumbnailColor: "bg-blue-100 text-blue-700" },
  { id: 6, name: "Safeguard Soap", size: "135 g", sku: "SOP-0006", barcode: "4801234567895", category: "Personal Care", stock: 60, reorderLevel: 20, lastUpdated: "May 21, 2024", updateTime: "06:20 PM", thumbnail: "SS", thumbnailColor: "bg-sky-100 text-sky-700" },
  { id: 7, name: "Tide Detergent Powder", size: "1 kg", sku: "DET-0007", barcode: "4801234567896", category: "Household", stock: 30, reorderLevel: 20, lastUpdated: "May 21, 2024", updateTime: "03:40 PM", thumbnail: "TD", thumbnailColor: "bg-orange-100 text-orange-700" },
];

const initialAdjustments = [
  { id: 1, productId: 1, product: "Premium Jasmine Rice", previousStock: 118, newStock: 120, difference: 2, reason: "Physical stock count", date: "May 23, 2024, 10:30 AM" },
  { id: 2, productId: 5, product: "Selecta Fortified Milk", previousStock: 3, newStock: 0, difference: -3, reason: "Damaged or expired items", date: "May 22, 2024, 11:10 AM" },
];

const stockTabs = ["All Stock Items", "In Stock", "Low Stock", "Out of Stock", "Stock Adjustments History"];

function getStockStatus(stock) {
  if (stock === 0) return "Out of Stock";
  if (stock <= 20) return "Low Stock";
  return "In Stock";
}

function StockAdjustmentHistory({ adjustments }) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Date &amp; Time</th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Previous Stock</th>
              <th className="px-4 py-3 font-medium">New Stock</th>
              <th className="px-4 py-3 font-medium">Change</th>
              <th className="px-4 py-3 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {adjustments.map((adjustment) => (
              <tr key={adjustment.id}>
                <td className="whitespace-nowrap px-4 py-3">{adjustment.date}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{adjustment.product}</td>
                <td className="px-4 py-3">{adjustment.previousStock} units</td>
                <td className="px-4 py-3">{adjustment.newStock} units</td>
                <td className={`px-4 py-3 font-semibold ${adjustment.difference >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {adjustment.difference > 0 ? "+" : ""}{adjustment.difference}
                </td>
                <td className="px-4 py-3">{adjustment.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StockManagement() {
  const [stockItems, setStockItems] = useState(initialStockItems);
  const [adjustments, setAdjustments] = useState(initialAdjustments);
  const [activeTab, setActiveTab] = useState("All Stock Items");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [availabilityFilter, setAvailabilityFilter] = useState("All Availability");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [historyProductId, setHistoryProductId] = useState(null);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);

  const categories = [...new Set(stockItems.map((item) => item.category))];

  const filteredItems = stockItems.filter((item) => {
    const stockStatus = getStockStatus(item.stock);
    const availability = item.stock > 0 ? "Available" : "Unavailable";
    const searchableText = `${item.name} ${item.sku} ${item.barcode}`.toLowerCase();
    const matchesSearch = searchableText.includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "All Categories" || item.category === categoryFilter;
    const matchesStatus = statusFilter === "All Statuses" || stockStatus === statusFilter;
    const matchesAvailability = availabilityFilter === "All Availability" || availability === availabilityFilter;
    const matchesTab = activeTab === "All Stock Items" || stockStatus === activeTab;

    return matchesSearch && matchesCategory && matchesStatus && matchesAvailability && matchesTab;
  });

  const visibleAdjustments = historyProductId
    ? adjustments.filter((adjustment) => adjustment.productId === historyProductId)
    : adjustments;

  function openUpdateModal(product = null) {
    setSelectedProduct(product);
    setIsUpdateOpen(true);
  }

  function saveStockUpdate(productId, newQuantity, reason) {
    const product = stockItems.find((item) => item.id === productId);
    const previousStock = product.stock;

    setStockItems((currentItems) =>
      currentItems.map((item) =>
        item.id === productId
          ? { ...item, stock: newQuantity, lastUpdated: "Sep 13, 2026", updateTime: "Now" }
          : item,
      ),
    );

    const newAdjustment = {
      id: Date.now(),
      productId,
      product: product.name,
      previousStock,
      newStock: newQuantity,
      difference: newQuantity - previousStock,
      reason,
      date: "Sep 13, 2026, Now",
    };

    setAdjustments((currentAdjustments) => [newAdjustment, ...currentAdjustments]);
    setIsUpdateOpen(false);
    setSelectedProduct(null);
  }

  function viewProductHistory(product) {
    setHistoryProductId(product.id);
    setActiveTab("Stock Adjustments History");
  }

  function changeTab(tab) {
    setActiveTab(tab);
    if (tab === "Stock Adjustments History") setHistoryProductId(null);
  }

  function clearFilters() {
    setSearchTerm("");
    setCategoryFilter("All Categories");
    setStatusFilter("All Statuses");
    setAvailabilityFilter("All Availability");
  }

  function exportStockItems() {
    const headings = ["Product", "SKU", "Barcode", "Category", "Current Stock", "Status"];
    const rows = filteredItems.map((item) => [item.name, item.sku, item.barcode, item.category, item.stock, getStockStatus(item.stock)]);
    const csvContent = [headings, ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const file = new Blob([csvContent], { type: "text/csv" });
    const downloadUrl = URL.createObjectURL(file);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = "grocerease-stock-items.csv";
    link.click();
    URL.revokeObjectURL(downloadUrl);
  }

  return (
    <InventoryLayout activePage="Stock Management">
      <div className="min-w-0 w-full">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stock Management</h1>
            <p className="mt-1 text-sm text-gray-500">Update stock quantity, view inventory levels, and manage stock adjustments.</p>
          </div>
          <StoreSelector />
        </div>

        <StockStatCards />

        <div className="mt-5 overflow-x-auto border-b border-gray-200">
          <div className="flex min-w-max gap-7 px-1">
            {stockTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => changeTab(tab)}
                className={`border-b-2 px-1 py-3 text-xs font-medium ${activeTab === tab ? "border-green-700 text-green-700" : "border-transparent text-gray-600 hover:text-gray-900"}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "Stock Adjustments History" ? (
          <div className="mt-5">
            {historyProductId && (
              <div className="mb-3 flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
                <p>Showing adjustment history for {stockItems.find((item) => item.id === historyProductId)?.name}.</p>
                <button type="button" onClick={() => setHistoryProductId(null)} className="font-semibold hover:underline">Show all history</button>
              </div>
            )}
            <StockAdjustmentHistory adjustments={visibleAdjustments} />
          </div>
        ) : (
          <>
            <section aria-label="Stock filters" className="my-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1.6fr)_repeat(3,minmax(140px,1fr))_auto]">
                <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by product name, SKU, or barcode..." className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100" />

                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600 outline-none focus:border-green-600">
                  <option>All Categories</option>
                  {categories.map((category) => <option key={category}>{category}</option>)}
                </select>

                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600 outline-none focus:border-green-600">
                  <option>All Statuses</option>
                  <option>In Stock</option>
                  <option>Low Stock</option>
                  <option>Out of Stock</option>
                </select>

                <select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600 outline-none focus:border-green-600">
                  <option>All Availability</option>
                  <option>Available</option>
                  <option>Unavailable</option>
                </select>

                <button type="button" onClick={clearFilters} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Clear</button>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={exportStockItems} className="flex-1 rounded-lg border border-green-600 bg-white px-5 py-2.5 text-sm font-medium text-green-700 hover:bg-green-50">Export</button>
                <button type="button" onClick={() => openUpdateModal()} className="flex-1 whitespace-nowrap rounded-lg bg-green-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-800">Update Stock</button>
              </div>
            </section>

            <StockTable items={filteredItems} onUpdate={openUpdateModal} onViewHistory={viewProductHistory} />
          </>
        )}
      </div>

      {isUpdateOpen && (
        <StockUpdateModal
          key={selectedProduct?.id || "stock-update"}
          items={stockItems}
          product={selectedProduct}
          onClose={() => setIsUpdateOpen(false)}
          onSave={saveStockUpdate}
        />
      )}
    </InventoryLayout>
  );
}

export default StockManagement;
