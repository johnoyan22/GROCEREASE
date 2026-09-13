import { useState } from "react";
import InventoryLayout from "../../components/inventory/layout/InventoryLayout";
import StoreSelector from "../../components/inventory/layout/StoreSelector";
import LowStockDetailsModal from "../../components/inventory/low-stock/LowStockDetailsModal";
import LowStockStatCards from "../../components/inventory/low-stock/LowStockStatCards";
import LowStockTable from "../../components/inventory/low-stock/LowStockTable";
import StockUpdateModal from "../../components/inventory/stock-management/StockUpdateModal";

const initialLowStockItems = [
  { id: 1, name: "Premium Jasmine Rice", size: "5 kg", sku: "RICE-0001", barcode: "4801234567890", category: "Staples", stock: 5, reorderLevel: 20, supplier: "Cebu Grain Supply", lastUpdated: "May 23, 2024", updateTime: "10:30 AM", thumbnail: "JR", thumbnailColor: "bg-amber-100 text-amber-800" },
  { id: 2, name: "Argentina Corned Beef", size: "175 g", sku: "CBEF-0002", barcode: "4801234567891", category: "Canned Goods", stock: 12, reorderLevel: 30, supplier: "Monde Foods", lastUpdated: "May 23, 2024", updateTime: "09:45 AM", thumbnail: "CB", thumbnailColor: "bg-red-100 text-red-700" },
  { id: 3, name: "Absolute Distilled Water", size: "1.5 L", sku: "WTR-0003", barcode: "4801234567892", category: "Beverages", stock: 8, reorderLevel: 24, supplier: "Asia Brewery", lastUpdated: "May 22, 2024", updateTime: "04:15 PM", thumbnail: "AW", thumbnailColor: "bg-cyan-100 text-cyan-700" },
  { id: 4, name: "Lucky Me Pancit Canton", size: "60 g", sku: "NOD-0004", barcode: "4801234567893", category: "Noodles", stock: 15, reorderLevel: 40, supplier: "Monde Foods", lastUpdated: "May 22, 2024", updateTime: "02:30 PM", thumbnail: "LM", thumbnailColor: "bg-yellow-100 text-yellow-800" },
  { id: 5, name: "Selecta Fortified Milk", size: "1 L", sku: "MLK-0005", barcode: "4801234567894", category: "Dairy", stock: 3, reorderLevel: 18, supplier: "RFM Corporation", lastUpdated: "May 22, 2024", updateTime: "11:10 AM", thumbnail: "FM", thumbnailColor: "bg-blue-100 text-blue-700" },
  { id: 6, name: "Safeguard Soap", size: "135 g", sku: "SOP-0006", barcode: "4801234567895", category: "Personal Care", stock: 17, reorderLevel: 36, supplier: "P&G Philippines", lastUpdated: "May 21, 2024", updateTime: "06:20 PM", thumbnail: "SS", thumbnailColor: "bg-sky-100 text-sky-700" },
  { id: 7, name: "Tide Detergent Powder", size: "1 kg", sku: "DET-0007", barcode: "4801234567896", category: "Household", stock: 9, reorderLevel: 20, supplier: "P&G Philippines", lastUpdated: "May 21, 2024", updateTime: "03:40 PM", thumbnail: "TD", thumbnailColor: "bg-orange-100 text-orange-700" },
];

function LowStockMonitoring() {
  const [items, setItems] = useState(initialLowStockItems);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [priorityFilter, setPriorityFilter] = useState("All Priorities");
  const [supplierFilter, setSupplierFilter] = useState("All Suppliers");
  const [detailsItem, setDetailsItem] = useState(null);
  const [updateItem, setUpdateItem] = useState(null);

  const categories = [...new Set(items.map((item) => item.category))];
  const suppliers = [...new Set(items.map((item) => item.supplier))];

  const filteredItems = items.filter((item) => {
    const priority = item.stock <= 10 ? "Critical" : "Low";
    const searchableText = `${item.name} ${item.sku} ${item.barcode}`.toLowerCase();
    return item.stock <= 20
      && searchableText.includes(searchTerm.toLowerCase())
      && (categoryFilter === "All Categories" || item.category === categoryFilter)
      && (priorityFilter === "All Priorities" || priority === priorityFilter)
      && (supplierFilter === "All Suppliers" || item.supplier === supplierFilter);
  });

  function saveStockUpdate(productId, newQuantity) {
    setItems((currentItems) => currentItems.map((item) => item.id === productId ? { ...item, stock: newQuantity, lastUpdated: "Sep 13, 2026", updateTime: "Now" } : item));
    setUpdateItem(null);
  }

  function openUpdateFromDetails(item) {
    setDetailsItem(null);
    setUpdateItem(item);
  }

  function exportLowStockItems() {
    const headings = ["Product", "SKU", "Category", "Current Stock", "Reorder Level", "Priority", "Supplier"];
    const rows = filteredItems.map((item) => [item.name, item.sku, item.category, item.stock, item.reorderLevel, item.stock <= 10 ? "Critical" : "Low", item.supplier]);
    const csv = [headings, ...rows].map((row) => row.map((value) => `"${value}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "grocerease-low-stock.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <InventoryLayout activePage="Low Stock Monitoring">
      <div className="min-w-0 w-full">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div><h1 className="text-2xl font-bold text-gray-900">Low Stock Monitoring</h1><p className="mt-1 text-sm text-gray-500">Monitor items that are running low in stock and need restocking.</p></div>
          <StoreSelector />
        </div>

        <LowStockStatCards />

        <section aria-label="Low stock filters" className="my-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1.6fr)_repeat(3,minmax(150px,1fr))]">
            <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by product name, SKU, or barcode..." className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100" />
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600"><option>All Categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select>
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600"><option>All Priorities</option><option>Critical</option><option>Low</option></select>
            <select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600"><option>All Suppliers</option>{suppliers.map((supplier) => <option key={supplier}>{supplier}</option>)}</select>
          </div>
          <button type="button" onClick={exportLowStockItems} className="rounded-lg border border-green-600 bg-white px-5 py-2.5 text-sm font-medium text-green-700 hover:bg-green-50">Export</button>
        </section>

        <LowStockTable items={filteredItems} onView={setDetailsItem} onUpdate={setUpdateItem} />
      </div>

      {detailsItem && <LowStockDetailsModal item={detailsItem} onClose={() => setDetailsItem(null)} onUpdate={openUpdateFromDetails} />}
      {updateItem && <StockUpdateModal key={updateItem.id} items={items} product={updateItem} onClose={() => setUpdateItem(null)} onSave={saveStockUpdate} />}
    </InventoryLayout>
  );
}

export default LowStockMonitoring;
