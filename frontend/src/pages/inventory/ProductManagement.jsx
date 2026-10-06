import { useState } from "react";
import InventoryLayout from "../../components/inventory/layout/InventoryLayout";
import StoreSelector from "../../components/inventory/layout/StoreSelector";
import ProductStatCards from "../../components/inventory/product-management/ProductStatCards";
import ProductTable from "../../components/inventory/product-management/ProductTable";
import ProductFormModal from "../../components/inventory/product-management/ProductFormModal";

// Temporary local data until Product Management is connected to an API.
const mockProducts = [
  { product_id: 1, store_inventory_id: 1, product_name: "Premium Jasmine Rice", sku: "RICE-0001", barcode: "4801234567890", size: "5 kg", category: "Staples", selling_price: 285, hard_stock_qty: 120, soft_stock_qty: 0, status: "Active", updated_at: "2026-05-23T10:30:00+08:00" },
  { product_id: 2, store_inventory_id: 2, product_name: "Argentina Corned Beef", sku: "CBEF-0002", barcode: "4801234567891", size: "175 g", category: "Canned Goods", selling_price: 62.5, hard_stock_qty: 85, soft_stock_qty: 0, status: "Active", updated_at: "2026-05-23T09:45:00+08:00" },
  { product_id: 3, store_inventory_id: 3, product_name: "Absolute Distilled Water", sku: "WTR-0003", barcode: "4801234567892", size: "1.5 L", category: "Beverages", selling_price: 38, hard_stock_qty: 200, soft_stock_qty: 0, status: "Active", updated_at: "2026-05-22T16:15:00+08:00" },
  { product_id: 4, store_inventory_id: 4, product_name: "Lucky Me Pancit Canton", sku: "NOD-0004", barcode: "4801234567893", size: "60 g", category: "Noodles", selling_price: 13.5, hard_stock_qty: 15, soft_stock_qty: 0, status: "Active", updated_at: "2026-05-22T14:30:00+08:00" },
  { product_id: 5, store_inventory_id: 5, product_name: "Selecta Fortified Milk", sku: "MLK-0005", barcode: "4801234567894", size: "1 L", category: "Dairy", selling_price: 85, hard_stock_qty: 0, soft_stock_qty: 0, status: "Inactive", updated_at: "2026-05-22T11:10:00+08:00" },
  { product_id: 6, store_inventory_id: 6, product_name: "Safeguard Soap", sku: "SOP-0006", barcode: "4801234567895", size: "135 g", category: "Personal Care", selling_price: 42, hard_stock_qty: 60, soft_stock_qty: 0, status: "Active", updated_at: "2026-05-21T18:20:00+08:00" },
  { product_id: 7, store_inventory_id: 7, product_name: "Tide Detergent Powder", sku: "DET-0007", barcode: "4801234567896", size: "1 kg", category: "Household", selling_price: 165, hard_stock_qty: 30, soft_stock_qty: 0, status: "Active", updated_at: "2026-05-21T15:40:00+08:00" },
];

function ProductManagement() {
  const [products, setProducts] = useState(mockProducts);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [availabilityFilter, setAvailabilityFilter] = useState("All Availability");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const categories = [...new Set(products.map((product) => product.category))];

  const filteredProducts = products.filter((product) => {
    const searchableText = `${product.product_name} ${product.sku} ${product.barcode} ${product.category}`.toLowerCase();
    const availableStock = product.hard_stock_qty - product.soft_stock_qty;
    const availability = product.status === "Active" && availableStock > 0 ? "Available" : "Unavailable";
    const matchesSearch = searchableText.includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "All Categories" || product.category === categoryFilter;
    const matchesStatus = statusFilter === "All Status" || product.status === statusFilter;
    const matchesAvailability = availabilityFilter === "All Availability" || availability === availabilityFilter;

    return matchesSearch && matchesCategory && matchesStatus && matchesAvailability;
  });

  function clearFilters() {
    setSearchTerm("");
    setCategoryFilter("All Categories");
    setStatusFilter("All Status");
    setAvailabilityFilter("All Availability");
  }

  function openNewProductForm() {
    setSelectedProduct(null);
    setIsFormOpen(true);
  }

  function openEditProductForm(product) {
    setSelectedProduct(product);
    setIsFormOpen(true);
  }

  function closeProductForm() {
    setIsFormOpen(false);
    setSelectedProduct(null);
  }

  function handleSaveProduct(productData) {
    const updatedAt = new Date().toISOString();

    if (selectedProduct) {
      setProducts((currentProducts) => currentProducts.map((product) =>
        product.product_id === selectedProduct.product_id
          ? { ...product, ...productData, updated_at: updatedAt }
          : product,
      ));
    } else {
      setProducts((currentProducts) => {
        const nextId = Math.max(0, ...currentProducts.map((product) => product.product_id)) + 1;
        return [...currentProducts, {
          ...productData,
          product_id: nextId,
          store_inventory_id: nextId,
          updated_at: updatedAt,
        }];
      });
    }

    closeProductForm();
  }

  return (
    <InventoryLayout activePage="Product Management">
      <div className="min-w-0 w-full">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Product Management</h1>
            <p className="mt-1 text-sm text-gray-500">View, manage, and update product information and availability.</p>
          </div>
          <StoreSelector />
        </div>

        <ProductStatCards products={products} />

        <section aria-label="Product filters" className="my-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1.6fr)_repeat(3,minmax(140px,1fr))_auto]">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by product name, barcode, or SKU..."
              className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            />
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600 outline-none focus:border-green-600">
              <option>All Categories</option>
              {categories.map((category) => <option key={category}>{category}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600 outline-none focus:border-green-600">
              <option>All Status</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
            <select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600 outline-none focus:border-green-600">
              <option>All Availability</option>
              <option>Available</option>
              <option>Unavailable</option>
            </select>
            <button type="button" onClick={clearFilters} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
              Clear
            </button>
          </div>
          <button type="button" onClick={openNewProductForm} className="rounded-lg bg-green-700 px-4 py-2.5 text-xs font-medium text-white hover:bg-green-800">
            + Add New Product
          </button>
        </section>

        <ProductTable products={filteredProducts} onEdit={openEditProductForm} />
      </div>

      {isFormOpen && (
        <ProductFormModal
          key={selectedProduct?.product_id ?? "new-product"}
          product={selectedProduct}
          onClose={closeProductForm}
          onSave={handleSaveProduct}
        />
      )}
    </InventoryLayout>
  );
}

export default ProductManagement;
