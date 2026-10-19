import { useState } from 'react';
import InventoryLayout from '../../components/inventory/layout/InventoryLayout';
import StoreSelector from '../../components/inventory/layout/StoreSelector';
import ProductStatCards from '../../components/inventory/product-management/ProductStatCards';
import ProductTable from '../../components/inventory/product-management/ProductTable';
import ProductFormModal from '../../components/inventory/product-management/ProductFormModal';
import InventoryLoadState from '../../components/inventory/shared/InventoryLoadState';
import useStoreInventory from '../../hooks/useStoreInventory';
import { createStoreProduct, updateStoreProduct } from '../../services/api';

function ProductManagement() {
  const { store, inventory, loading, error, reload } = useStoreInventory();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [success, setSuccess] = useState('');

  const categories = [...new Set(inventory.map((item) => item.category))].sort();
  const filtered = inventory.filter((item) => {
    const text = [item.product_name, item.sku, item.barcode, item.category, item.size].join(' ').toLowerCase();
    return text.includes(search.toLowerCase()) && (!category || item.category === category) && (!status || item.status === status);
  });

  function openForm(product = null) {
    setEditing(product);
    setSuccess('');
    setFormOpen(true);
  }

  async function saveProduct(details) {
    const result = editing
      ? await updateStoreProduct(editing.store_inventory_id, details)
      : await createStoreProduct(details);
    setFormOpen(false);
    setEditing(null);
    setSuccess(result.message);
    reload();
  }

  return (
    <InventoryLayout activePage="Product Management">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Management</h1>
          <p className="mt-1 text-sm text-gray-500">Add and manage products, details, and prices for your assigned store.</p>
        </div>
        <StoreSelector store={store} loading={loading} error={error} />
      </div>
      {success && <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{success}</p>}
      <InventoryLoadState loading={loading} error={error} onRetry={reload} />
      {!loading && !error && store && (
        <>
          <ProductStatCards products={inventory} />
          <section aria-label="Product filters" className="my-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.6fr)_repeat(2,minmax(130px,1fr))_auto]">
              <input aria-label="Search store products" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product name, SKU, or barcode..." className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs" />
              <select aria-label="Product category" value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs">
                <option value="">All Categories</option>
                {categories.map((value) => <option key={value}>{value}</option>)}
              </select>
              <select aria-label="Offering status" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs">
                <option value="">All Statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
              </select>
              <button type="button" onClick={() => { setSearch(''); setCategory(''); setStatus(''); }} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs">Clear</button>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={reload} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs">Refresh</button>
              <button type="button" onClick={() => openForm()} className="rounded-lg bg-green-700 px-4 py-2.5 text-xs font-medium text-white hover:bg-green-800">+ Add New Product</button>
            </div>
          </section>
          <ProductTable products={filtered} onEdit={openForm} />
        </>
      )}
      {formOpen && <ProductFormModal key={editing?.store_inventory_id ?? 'new'} product={editing} storeName={store?.store_name} onClose={() => setFormOpen(false)} onSave={saveProduct} />}
    </InventoryLayout>
  );
}

export default ProductManagement;
