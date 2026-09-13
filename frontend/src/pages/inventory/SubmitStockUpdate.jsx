import { useState } from "react";
import InventoryLayout from "../../components/inventory/layout/InventoryLayout";
import StoreSelector from "../../components/inventory/layout/StoreSelector";
import StockProductSelection from "../../components/inventory/stock-update/StockProductSelection";
import StockQuantityStep from "../../components/inventory/stock-update/StockQuantityStep";
import StockReviewStep from "../../components/inventory/stock-update/StockReviewStep";

const products = [
  { id: 1, name: "Premium Jasmine Rice", size: "5 kg", sku: "RICE-0001", barcode: "4801234567890", category: "Staples", stock: 120, thumbnail: "JR", thumbnailColor: "bg-amber-100 text-amber-800" },
  { id: 2, name: "Argentina Corned Beef", size: "175 g", sku: "CBEF-0002", barcode: "4801234567891", category: "Canned Goods", stock: 18, thumbnail: "CB", thumbnailColor: "bg-red-100 text-red-700" },
  { id: 3, name: "Absolute Distilled Water", size: "1.5 L", sku: "WTR-0003", barcode: "4801234567892", category: "Beverages", stock: 8, thumbnail: "AW", thumbnailColor: "bg-cyan-100 text-cyan-700" },
  { id: 4, name: "Lucky Me Pancit Canton", size: "60 g", sku: "NOD-0004", barcode: "4801234567893", category: "Noodles", stock: 15, thumbnail: "LM", thumbnailColor: "bg-yellow-100 text-yellow-800" },
  { id: 5, name: "Selecta Fortified Milk", size: "1 L", sku: "MLK-0005", barcode: "4801234567894", category: "Dairy", stock: 3, thumbnail: "FM", thumbnailColor: "bg-blue-100 text-blue-700" },
];

const steps = ["Select Products", "Update Quantities", "Review & Submit"];

function SubmitStockUpdate() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedIds, setSelectedIds] = useState([1, 2, 3]);
  const [quantities, setQuantities] = useState({ 1: 120, 2: 18, 3: 8 });
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const categories = [...new Set(products.map((product) => product.category))];
  const selectedProducts = products.filter((product) => selectedIds.includes(product.id));
  const filteredProducts = products.filter((product) => {
    const status = product.stock <= 10 ? "Critical" : product.stock <= 20 ? "Low Stock" : "Available";
    return `${product.name} ${product.sku} ${product.barcode}`.toLowerCase().includes(searchTerm.toLowerCase())
      && (categoryFilter === "All Categories" || product.category === categoryFilter)
      && (statusFilter === "All Statuses" || status === statusFilter);
  });

  function toggleProduct(productId) {
    if (selectedIds.includes(productId)) {
      setSelectedIds((currentIds) => currentIds.filter((id) => id !== productId));
      setQuantities((currentQuantities) => {
        const nextQuantities = { ...currentQuantities };
        delete nextQuantities[productId];
        return nextQuantities;
      });
    } else {
      const product = products.find((item) => item.id === productId);
      setSelectedIds((currentIds) => [...currentIds, productId]);
      setQuantities((currentQuantities) => ({ ...currentQuantities, [productId]: product.stock }));
    }
  }

  function updateQuantity(productId, quantity) {
    setQuantities((currentQuantities) => ({ ...currentQuantities, [productId]: quantity }));
  }

  function submitUpdates() {
    setIsSubmitted(true);
  }

  function startAnotherUpdate() {
    setCurrentStep(1);
    setSelectedIds([]);
    setQuantities({});
    setIsSubmitted(false);
  }

  return (
    <InventoryLayout activePage="Submit Stock Update">
      <div className="min-w-0 w-full">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div><h1 className="text-2xl font-bold text-gray-900">Submit Stock Update</h1><p className="mt-1 text-sm text-gray-500">Update the current stock quantity of products accurately.</p></div>
          <StoreSelector />
        </div>

        <div className="mb-7 grid grid-cols-1 gap-3 md:grid-cols-3">
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const isActive = stepNumber === currentStep;
            const isComplete = stepNumber < currentStep || isSubmitted;
            return (
              <div key={step} className={`flex items-center gap-3 rounded-xl border p-4 ${isActive ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"}`}>
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${isComplete || isActive ? "bg-green-700 text-white" : "bg-gray-200 text-gray-500"}`}>{isComplete ? "OK" : stepNumber}</span>
                <div><p className="text-sm font-medium text-gray-900">{step}</p><p className="mt-0.5 text-[10px] text-gray-500">Step {stepNumber} of 3</p></div>
              </div>
            );
          })}
        </div>

        {isSubmitted ? (
          <section className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-700 text-xl font-bold text-white">OK</div>
            <h2 className="mt-4 text-xl font-bold text-green-900">Stock update submitted</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-green-800">Your update for {selectedProducts.length} product{selectedProducts.length === 1 ? "" : "s"} has been recorded locally and is ready for supervisor review.</p>
            <button type="button" onClick={startAnotherUpdate} className="mt-5 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-800">Submit Another Update</button>
          </section>
        ) : (
          <>
            {currentStep === 1 && (
              <>
                <div className="mb-4"><h2 className="text-base font-semibold text-gray-900">Select Products</h2><p className="mt-1 text-xs text-gray-500">Search and select the products you want to update.</p></div>
                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(260px,1.5fr)_minmax(160px,0.7fr)_minmax(160px,0.7fr)]">
                  <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by product name, SKU, or barcode..." className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100" />
                  <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600"><option>All Categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600"><option>All Statuses</option><option>Available</option><option>Low Stock</option><option>Critical</option></select>
                </div>
                <StockProductSelection products={filteredProducts} selectedIds={selectedIds} onToggle={toggleProduct} />
              </>
            )}

            {currentStep === 2 && <><div className="mb-4"><h2 className="text-base font-semibold text-gray-900">Update Quantities</h2><p className="mt-1 text-xs text-gray-500">Enter the new physical stock count for each selected product.</p></div><StockQuantityStep products={selectedProducts} quantities={quantities} onQuantityChange={updateQuantity} /></>}
            {currentStep === 3 && <StockReviewStep products={selectedProducts} quantities={quantities} />}

            <div className="mt-5 flex flex-col gap-3 rounded-xl border border-green-100 bg-green-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm font-medium text-green-900">{selectedProducts.length} product{selectedProducts.length === 1 ? "" : "s"} selected</p><p className="mt-1 text-xs text-green-700">Changes remain temporary until they are connected to Laravel.</p></div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setCurrentStep((step) => Math.max(1, step - 1))} disabled={currentStep === 1} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 disabled:opacity-40">Back</button>
                {currentStep < 3 ? <button type="button" disabled={selectedIds.length === 0} onClick={() => setCurrentStep((step) => step + 1)} className="rounded-lg bg-green-700 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40">Next</button> : <button type="button" onClick={submitUpdates} className="rounded-lg bg-green-700 px-5 py-2.5 text-sm font-medium text-white">Submit Updates</button>}
              </div>
            </div>
          </>
        )}
      </div>
    </InventoryLayout>
  );
}

export default SubmitStockUpdate;
