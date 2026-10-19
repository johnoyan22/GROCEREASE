import { useState } from 'react';
import { Link } from 'react-router-dom';
import InventoryLayout from '../../components/inventory/layout/InventoryLayout';
import StoreSelector from '../../components/inventory/layout/StoreSelector';
import StockStatCards from '../../components/inventory/stock-management/StockStatCards';
import StockTable from '../../components/inventory/stock-management/StockTable';
import InventoryLoadState from '../../components/inventory/shared/InventoryLoadState';
import useStoreInventory from '../../hooks/useStoreInventory';

function StockManagement() {
  const { store, inventory, loading, error, reload } = useStoreInventory();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const categories = [...new Set(inventory.map((item) => item.category))].sort();
  const filtered = inventory.filter((item) => {
    const text = [item.product_name, item.sku, item.barcode, item.size].join(' ').toLowerCase();
    return text.includes(search.toLowerCase()) && (!category || item.category === category) && (!status || item.status === status);
  });

  function exportStock() {
    const rows = [
      ['Product', 'SKU', 'Barcode', 'Category', 'Selling Price', 'Physical', 'Reserved', 'Available', 'Limit per order', 'Low threshold', 'Offering Status'],
      ...filtered.map((item) => [item.product_name, item.sku, item.barcode, item.category, item.selling_price, item.hard_stock_qty, item.soft_stock_qty, item.available_stock, item.max_per_order, item.low_stock_threshold, item.status]),
    ];
    const csv = rows.map((row) => row.map((value) => {
      const text = String(value ?? '');
      const safe = /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
      return '"' + safe.replaceAll('"', '""') + '"';
    }).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'grocerease-store-' + store.store_id + '-inventory.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <InventoryLayout activePage="Stock Management">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Stock Management</h1><p className="mt-1 text-sm text-gray-500">View the inventory quantities recorded for your assigned store.</p></div>
        <StoreSelector store={store} loading={loading} error={error} />
      </div>
      <InventoryLoadState loading={loading} error={error} onRetry={reload} />
      {!loading && !error && store && (
        <>
          <StockStatCards items={inventory} />
          <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Available stock = physical stock − reserved stock. <Link to="/inventory/stock-update" className="font-semibold underline">Request a physical-count correction</Link> for Supervisor approval. <Link to="/inventory/low-stock" className="font-semibold underline">Report low stock</Link> without changing quantities.</p>
          <section aria-label="Stock filters" className="my-5 flex flex-col gap-3 xl:flex-row xl:justify-between">
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.6fr)_repeat(2,minmax(130px,1fr))_auto]">
              <input aria-label="Search stock" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product name, SKU, or barcode..." className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs" />
              <select aria-label="Stock category" value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs"><option value="">All Categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select>
              <select aria-label="Stock offering status" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs"><option value="">All Statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
              <button type="button" onClick={() => { setSearch(''); setCategory(''); setStatus(''); }} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs">Clear</button>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={reload} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs">Refresh</button>
              <button type="button" onClick={exportStock} disabled={filtered.length === 0} className="rounded-lg border border-green-600 bg-white px-4 py-2.5 text-xs font-medium text-green-700 disabled:opacity-50">Export</button>
            </div>
          </section>
          <StockTable items={filtered} />
        </>
      )}
    </InventoryLayout>
  );
}

export default StockManagement;
