import { useState } from 'react';
import useStoreInventory from '../../hooks/useStoreInventory';
import StoreSelector from '../inventory/layout/StoreSelector';
import ProductTable from '../inventory/product-management/ProductTable';
import InventoryLoadState from '../inventory/shared/InventoryLoadState';

export function SupervisorInventory() {
  const { store, inventory, loading, error, reload } = useStoreInventory();
  const [search, setSearch] = useState('');
  const filtered = inventory.filter((item) =>
    [item.product_name, item.sku, item.barcode, item.category, item.size]
      .join(' ').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row">
        <div><h1 className="text-2xl font-bold text-gray-900">Store Products</h1><p className="mt-1 text-sm text-gray-500">View products and recorded quantities for your assigned store.</p></div>
        <StoreSelector store={store} loading={loading} error={error} />
      </div>
      <InventoryLoadState loading={loading} error={error} onRetry={reload} />
      {!loading && !error && store && (
        <>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row">
            <input aria-label="Search store products" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your store products..." className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
            <button type="button" onClick={reload} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm">Refresh</button>
          </div>
          <ProductTable products={filtered} />
        </>
      )}
    </div>
  );
}
