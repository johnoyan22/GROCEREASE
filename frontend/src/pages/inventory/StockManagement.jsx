import { useState } from 'react';
import { Link } from 'react-router-dom';
import InventoryLayout from '../../components/inventory/layout/InventoryLayout';
import StoreSelector from '../../components/inventory/layout/StoreSelector';
import StockStatCards from '../../components/inventory/stock-management/StockStatCards';
import StockTable from '../../components/inventory/stock-management/StockTable';
import StockReceiptModal from '../../components/inventory/stock-management/StockReceiptModal';
import InventoryLoadState from '../../components/inventory/shared/InventoryLoadState';
import useStoreInventory from '../../hooks/useStoreInventory';

function StockManagement() {
  const { store, inventory, loading, error, reload } = useStoreInventory();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [receiving, setReceiving] = useState(false);
  const [notice, setNotice] = useState('');
  const categories = [...new Set(inventory.map((item) => item.category))].sort();
  const filtered = inventory.filter((item) => {
    const text = [item.product_name, item.sku, item.barcode, item.size].join(' ').toLowerCase();
    return text.includes(search.toLowerCase()) && (!category || item.category === category) && (!status || item.status === status);
  });

  function stockSubmitted(message) {
    setNotice(message);
    reload();
  }

  return (
    <InventoryLayout activePage="Stock Management">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Stock Management</h1><p className="mt-1 text-sm text-gray-500">View the inventory quantities recorded for your assigned store.</p></div>
        <StoreSelector store={store} loading={loading} error={error} />
      </div>
      {notice && <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      <InventoryLoadState loading={loading} error={error} onRetry={reload} />
      {!loading && !error && store && (
        <>
          <StockStatCards items={inventory} />
          <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Available stock excludes reservations, expired and on-hold batches. <Link to="/inventory/stock-update" className="font-semibold underline">Request a physical-count correction</Link> for Supervisor approval. <Link to="/inventory/low-stock" className="font-semibold underline">View automatic low-stock monitoring</Link>.</p>
          <section aria-label="Stock filters" className="my-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.6fr)_repeat(2,minmax(130px,1fr))_auto]">
              <input aria-label="Search stock" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product name, SKU, or barcode..." className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs" />
              <select aria-label="Stock category" value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs"><option value="">All Categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select>
              <select aria-label="Stock offering status" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs"><option value="">All Statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
              <button type="button" onClick={() => { setSearch(''); setCategory(''); setStatus(''); }} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs">Clear</button>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={reload} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs">Refresh</button>
              <button type="button" onClick={() => setReceiving(true)} className="whitespace-nowrap rounded-lg bg-green-700 px-4 py-2.5 text-xs font-medium text-white hover:bg-green-800">+ Add Stock</button>
            </div>
          </section>
          <StockTable items={filtered} />
        </>
      )}
      {receiving && <StockReceiptModal products={inventory} onClose={() => setReceiving(false)} onSaved={stockSubmitted} />}
    </InventoryLayout>
  );
}

export default StockManagement;
