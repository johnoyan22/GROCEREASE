import { useState, useEffect } from "react";
import axios from "axios";
import InventoryLayout from "../../components/inventory/layout/InventoryLayout";
import StoreSelector from "../../components/inventory/layout/StoreSelector";
import ProductStatCards from "../../components/inventory/product-management/ProductStatCards";
import ProductTable from "../../components/inventory/product-management/ProductTable";
import ProductFormModal from "../../components/inventory/product-management/ProductFormModal";
import { getXsrfToken } from "../../services/api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

function normalizeProduct(product) {
  return {
    ...product,
    product_name: product.product_name ?? product.name,
    hard_stock_qty: product.hard_stock_qty ?? product.stock_quantity ?? 0,
  };
}

function toApiProduct(product) {
  const { product_name, hard_stock_qty, ...fields } = product;
  return {
    ...fields,
    name: product_name,
    stock_quantity: hard_stock_qty,
  };
}

function ProductManagement() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [availabilityFilter, setAvailabilityFilter] = useState("All Availability");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Fetch real products from your Laravel backend on mount cleanly without triggering warnings
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await axios.get(`${API_URL}/products`, { withCredentials: true });
        setProducts((response.data.data || response.data).map(normalizeProduct));
        setLoading(false);
      } catch (err) {
        console.error("Error fetching products:", err);
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const categories = [...new Set(products.map((product) => product.category))];

  const filteredProducts = products.filter((product) => {
    const searchableText = `${product.name || product.product_name} ${product.sku} ${product.barcode || ''} ${product.category}`.toLowerCase();
    const hardStock = product.hard_stock_qty ?? product.stock_quantity ?? 0;
    const softStock = product.soft_stock_qty ?? 0;
    const availableStock = hardStock - softStock;
    const availability = (product.status === "Active" || product.status === "In Stock") && availableStock > 0 ? "Available" : "Unavailable";
    
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

  async function handleSaveProduct(productData) {
    try {
      const xsrfToken = await getXsrfToken();
      const requestConfig = {
        withCredentials: true,
        headers: { "X-XSRF-TOKEN": xsrfToken },
      };
      const apiProduct = toApiProduct(productData);
      
      if (selectedProduct) {
        await axios.put(`${API_URL}/products/${selectedProduct.product_id || selectedProduct.id}`, apiProduct, requestConfig);
      } else {
        await axios.post(`${API_URL}/products`, apiProduct, requestConfig);
      }

      // Re-fetch products after save
      const response = await axios.get(`${API_URL}/products`, { withCredentials: true });
      setProducts((response.data.data || response.data).map(normalizeProduct));
      closeProductForm();
    } catch (err) {
      console.error("Failed to save product:", err.response?.data || err.message);
      alert(err.response?.data?.message || err.message || "Failed to save product.");
    }
  }

  return (
    <InventoryLayout activePage="Product Management">
      <div className="min-w-0 w-full">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Product Management</h1>
            <p className="mt-1 text-sm text-gray-500">View, manage, and update product information and availability from the database.</p>
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

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading live product catalog from database...</div>
        ) : (
          <ProductTable products={filteredProducts} onEdit={openEditProductForm} />
        )}
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