import { useState } from "react";
import InventoryLayout from "../../components/inventory/layout/InventoryLayout";
import StoreSelector from "../../components/inventory/layout/StoreSelector";
import ProductFormModal from "../../components/inventory/product-management/ProductFormModal";
import ProductStatCards from "../../components/inventory/product-management/ProductStatCards";
import ProductTable from "../../components/inventory/product-management/ProductTable";

const initialProducts = [
  { id: 1, name: "Premium Jasmine Rice", size: "5 kg", sku: "RICE-0001", barcode: "4801234567890", category: "Staples", price: 285, stock: 120, availability: "Available", status: "Active", lastUpdated: "May 23, 2024", updateTime: "10:30 AM", thumbnail: "JR", thumbnailColor: "bg-amber-100 text-amber-800" },
  { id: 2, name: "Argentina Corned Beef", size: "175 g", sku: "CBEF-0002", barcode: "4801234567891", category: "Canned Goods", price: 62.5, stock: 85, availability: "Available", status: "Active", lastUpdated: "May 23, 2024", updateTime: "09:45 AM", thumbnail: "CB", thumbnailColor: "bg-red-100 text-red-700" },
  { id: 3, name: "Absolute Distilled Water", size: "1.5 L", sku: "WTR-0003", barcode: "4801234567892", category: "Beverages", price: 28, stock: 200, availability: "Available", status: "Active", lastUpdated: "May 22, 2024", updateTime: "04:15 PM", thumbnail: "AW", thumbnailColor: "bg-cyan-100 text-cyan-700" },
  { id: 4, name: "Lucky Me Pancit Canton", size: "60 g", sku: "NOD-0004", barcode: "4801234567893", category: "Noodles", price: 13.5, stock: 15, availability: "Available", status: "Active", lastUpdated: "May 22, 2024", updateTime: "02:30 PM", thumbnail: "LM", thumbnailColor: "bg-yellow-100 text-yellow-800" },
  { id: 5, name: "Selecta Fortified Milk", size: "1 L", sku: "MLK-0005", barcode: "4801234567894", category: "Dairy", price: 85, stock: 0, availability: "Unavailable", status: "Inactive", lastUpdated: "May 22, 2024", updateTime: "11:10 AM", thumbnail: "FM", thumbnailColor: "bg-blue-100 text-blue-700" },
  { id: 6, name: "Safeguard Soap", size: "135 g", sku: "SOP-0006", barcode: "4801234567895", category: "Personal Care", price: 42, stock: 60, availability: "Available", status: "Active", lastUpdated: "May 21, 2024", updateTime: "06:20 PM", thumbnail: "SS", thumbnailColor: "bg-sky-100 text-sky-700" },
  { id: 7, name: "Tide Detergent Powder", size: "1 kg", sku: "DET-0007", barcode: "4801234567896", category: "Household", price: 165, stock: 30, availability: "Available", status: "Active", lastUpdated: "May 21, 2024", updateTime: "03:40 PM", thumbnail: "TD", thumbnailColor: "bg-orange-100 text-orange-700" },
];

function ProductManagement() {
  const [products, setProducts] = useState(initialProducts);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [availabilityFilter, setAvailabilityFilter] = useState("All Availability");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const categories = [...new Set(products.map((product) => product.category))];

  const filteredProducts = products.filter((product) => {
    const searchableText = `${product.name} ${product.sku} ${product.barcode}`.toLowerCase();
    const matchesSearch = searchableText.includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "All Categories" || product.category === categoryFilter;
    const matchesStatus = statusFilter === "All Statuses" || product.status === statusFilter;
    const matchesAvailability = availabilityFilter === "All Availability" || product.availability === availabilityFilter;

    return matchesSearch && matchesCategory && matchesStatus && matchesAvailability;
  });

  function openAddForm() {
    setSelectedProduct(null);
    setIsFormOpen(true);
  }

  function openEditForm(product) {
    setSelectedProduct(product);
    setIsFormOpen(true);
  }

  function saveProduct(productData) {
    const productWithAvailability = {
      ...productData,
      availability: productData.stock > 0 ? "Available" : "Unavailable",
    };

    if (selectedProduct) {
      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === selectedProduct.id
            ? { ...product, ...productWithAvailability, lastUpdated: "Sep 13, 2026", updateTime: "Now" }
            : product,
        ),
      );
    } else {
      const newProduct = {
        ...productWithAvailability,
        id: Date.now(),
        lastUpdated: "Sep 13, 2026",
        updateTime: "Now",
        thumbnail: productData.name.slice(0, 2).toUpperCase(),
        thumbnailColor: "bg-green-100 text-green-700",
      };

      setProducts((currentProducts) => [newProduct, ...currentProducts]);
    }

    setIsFormOpen(false);
    setSelectedProduct(null);
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

        <ProductStatCards />

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
              <option>All Statuses</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>

            <select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600 outline-none focus:border-green-600">
              <option>All Availability</option>
              <option>Available</option>
              <option>Unavailable</option>
            </select>

            <button type="button" onClick={() => { setSearchTerm(""); setCategoryFilter("All Categories"); setStatusFilter("All Statuses"); setAvailabilityFilter("All Availability"); }} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
              Clear
            </button>
          </div>

          <button type="button" onClick={openAddForm} className="rounded-lg bg-green-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-800">
            + Add New Product
          </button>
        </section>

        <ProductTable products={filteredProducts} onEdit={openEditForm} />
      </div>

      {isFormOpen && (
        <ProductFormModal
          key={selectedProduct?.id || "new-product"}
          product={selectedProduct}
          onClose={() => setIsFormOpen(false)}
          onSave={saveProduct}
        />
      )}
    </InventoryLayout>
  );
}

export default ProductManagement;
