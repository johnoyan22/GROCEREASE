import { useState } from 'react';
import { sellingUnits } from '../../../services/product-units';
import ProductDetailsModal from './ProductDetailsModal';

export default function ProductTable({ products, onEdit, showReceivedDate = false, onReload, supervisor = false }) {
  const [details, setDetails] = useState(null);
  const [notice, setNotice] = useState('');
  function saved(message) { setNotice(message); setDetails(null); onReload?.(); }

  function receivedDates(product) {
    if (Array.isArray(product.expiry_received_dates)) return product.expiry_received_dates.length
      ? product.expiry_received_dates.map((date) => date || 'Unknown').join(', ') : product.has_unknown_expiry ? 'Unknown' : '—';
    const batches = (product.batches ?? []).filter((batch) => batch.remaining_quantity > 0 && batch.status === 'active'
      && (product.nearest_expiry ? batch.expiry_date === product.nearest_expiry : !batch.expiry_date));
    const dates = [...new Set(batches.map((batch) => batch.received_date || 'Unknown'))].sort();
    return dates.length ? dates.join(', ') : product.hard_stock_qty > 0 && !product.batches?.length ? 'Unknown' : '—';
  }

  return <>
    {notice && <p role="status" className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className={'w-full text-left text-xs ' + (showReceivedDate ? 'min-w-[900px]' : 'min-w-[790px]')}>
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-500"><tr>{['Product / Size', 'Physical Stock', 'Available Stock', 'Re-order Level', ...(showReceivedDate ? ['Date Received'] : []), 'Expiry', 'Status', 'Actions'].map((label) => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">{products.map((product) => <tr key={product.store_inventory_id} className="hover:bg-gray-50/70">
            <td className="px-4 py-3"><p className="font-medium text-gray-900">{product.product_name}</p><p className="mt-1">{product.size || 'Count only / size unconfigured'}</p><p className="mt-1 break-all text-gray-500">{product.sku}</p></td>
            <td className="px-4 py-3">{product.hard_stock_qty} {sellingUnits(product, product.hard_stock_qty)}{product.is_low_stock && <span className="mt-1 block font-semibold text-amber-800">Low stock</span>}</td>
            <td className="px-4 py-3">{product.available_stock} {sellingUnits(product, product.available_stock)}</td>
            <td className="px-4 py-3">{product.low_stock_threshold == null ? 'Not configured' : `${product.low_stock_threshold} ${sellingUnits(product, product.low_stock_threshold)}`}</td>
            {showReceivedDate && <td className="px-4 py-3">{receivedDates(product)}</td>}
            <td className="px-4 py-3">{product.nearest_expiry || 'No known eligible date'}{product.has_unknown_expiry && <p className="mt-1 text-amber-800">Unknown dates present</p>}{product.expired_quantity > 0 && <p className="mt-1 text-red-700">{product.expired_quantity} expired {sellingUnits(product, product.expired_quantity)}</p>}</td>
            <td className="px-4 py-3"><span className={product.status === 'active' ? 'text-green-700' : 'text-gray-600'}>{product.status === 'active' ? 'Active' : 'Inactive'}</span></td>
            <td className="px-4 py-3"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setDetails(product)} className="rounded-lg border px-3 py-2">View Details</button>{onEdit && <button type="button" aria-label={`Edit ${product.product_name} ${product.size || ''}`} onClick={() => onEdit(product)} className="rounded-lg border px-3 py-2">Edit</button>}</div></td>
          </tr>)}</tbody>
        </table>
      </div>
      {products.length === 0 && <p className="p-8 text-center text-sm text-gray-600">No matching store products.</p>}
      <p className="border-t px-4 py-3 text-xs text-gray-500">Showing {products.length} store product{products.length === 1 ? '' : 's'}</p>
    </section>
    {details && <ProductDetailsModal key={details.store_inventory_id} product={details} supervisor={supervisor} onClose={() => setDetails(null)} onSaved={saved} />}
  </>;
}
