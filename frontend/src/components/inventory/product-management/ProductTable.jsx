import { Pencil } from 'lucide-react';

const moneyFormatter = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

function ProductTable({ products, onEdit }) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
            <tr>
              {['Product', 'SKU / Barcode', 'Category', 'Selling Price', 'Hard Stock', 'Soft Stock', 'Offering Status', 'Last Updated', ...(onEdit ? ['Actions'] : [])].map((title) => <th key={title} scope="col" className="px-4 py-3 font-medium">{title}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {products.map((product) => (
              <tr key={product.store_inventory_id} className="hover:bg-gray-50/70">
                <td className="px-4 py-3"><p className="font-medium text-gray-900">{product.product_name}</p><p className="mt-1 text-gray-500">{product.size || '—'}</p></td>
                <td className="px-4 py-3"><p>{product.sku}</p><p className="mt-1 text-gray-500">{product.barcode || '—'}</p></td>
                <td className="px-4 py-3">{product.category}</td>
                <td className="px-4 py-3 font-medium">{moneyFormatter.format(product.selling_price)}</td>
                <td className="px-4 py-3">{product.hard_stock_qty}</td>
                <td className="px-4 py-3">{product.soft_stock_qty}</td>
                <td className="px-4 py-3"><span className={'rounded px-2 py-1 text-xs ' + (product.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600')}>{product.status === 'active' ? 'Active' : 'Inactive'}</span></td>
                <td className="whitespace-nowrap px-4 py-3">{product.updated_at ? new Date(product.updated_at).toLocaleString('en-PH') : '—'}</td>
                {onEdit && <td className="px-4 py-3"><button type="button" aria-label={'Edit ' + product.product_name + ' ' + (product.size || '')} onClick={() => onEdit(product)} className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50"><Pencil size={14} aria-hidden="true" /></button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {products.length === 0 && <div className="px-4 py-12 text-center"><p className="font-medium text-gray-700">No matching store products</p><p className="mt-1 text-xs text-gray-500">Change your filters or add a new product to your store.</p></div>}
      <div className="border-t border-gray-100 px-4 py-4 text-xs text-gray-500">Showing {products.length} store product{products.length === 1 ? '' : 's'}</div>
    </section>
  );
}

export default ProductTable;
