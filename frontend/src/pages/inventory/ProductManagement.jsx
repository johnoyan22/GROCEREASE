import { useEffect, useState } from "react";
import InventoryLayout from "../../components/inventory/layout/InventoryLayout";
import StoreSelector from "../../components/inventory/layout/StoreSelector";
import ProductStatCards from "../../components/inventory/product-management/ProductStatCards";
import ProductTable from "../../components/inventory/product-management/ProductTable";
import { apiRequest } from "../../services/api";

function ProductManagement() {
  const [products, setProducts] = useState([]);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [availabilityFilter, setAvailabilityFilter] = useState("All Availability");

  useEffect(() => {
    const requestController = new AbortController();

    async function loadProducts() {
      try {
        const response = await apiRequest("/inventory/products", {
          signal: requestController.signal,
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to load inventory products.");
        }

        setProducts(data.products ?? []);
        setStore(data.store ?? null);
      } catch (error) {
        if (error.name !== "AbortError") {
          setErrorMessage(error.message || "Unable to connect to the inventory API.");
        }
      } finally {
        if (!requestController.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => requestController.abort();
  }, []);

  const categories = [...new Set(products.map((product) => product.category))];

  const filteredProducts = products.filter((product) => {
    const searchableText = `${product.product_name} ${product.category}`.toLowerCase();
    const matchesSearch = searchableText.includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "All Categories" || product.category === categoryFilter;
    const matchesAvailability = availabilityFilter === "All Availability" || product.availability === availabilityFilter;

    return matchesSearch && matchesCategory && matchesAvailability;
  });

  function clearFilters() {
    setSearchTerm("");
    setCategoryFilter("All Categories");
    setAvailabilityFilter("All Availability");
  }

  return (
    <InventoryLayout activePage="Product Management">
      <div className="min-w-0 w-full">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Product Management</h1>
            <p className="mt-1 text-sm text-gray-500">View products and stock assigned to your store.</p>
          </div>

          <StoreSelector store={store} />
        </div>

        <ProductStatCards products={products} />

        <section aria-label="Product filters" className="my-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1.6fr)_repeat(2,minmax(160px,1fr))_auto]">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by product name or category..."
              className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            />

            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600 outline-none focus:border-green-600">
              <option>All Categories</option>
              {categories.map((category) => <option key={category}>{category}</option>)}
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
        </section>

        {loading && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-500">
            Loading products...
          </div>
        )}

        {!loading && errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && <ProductTable products={filteredProducts} />}
      </div>
    </InventoryLayout>
  );
}

export default ProductManagement;
