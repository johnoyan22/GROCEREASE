function LowStockDetailsModal({ item, onClose, onUpdate }) {
  const priority = item.stock <= 10 ? "Critical" : "Low";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="low-stock-details-title" className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 id="low-stock-details-title" className="text-lg font-bold text-gray-900">Low Stock Details</h2>
            <p className="mt-1 text-xs text-gray-500">{item.sku}</p>
          </div>
          <button type="button" aria-label="Close low stock details" onClick={onClose} className="rounded-md p-2 text-gray-500 hover:bg-gray-100">X</button>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4">
            <span className={`flex h-12 w-11 items-center justify-center rounded-lg text-xs font-bold ${item.thumbnailColor}`}>{item.thumbnail}</span>
            <div>
              <p className="font-semibold text-gray-900">{item.name}</p>
              <p className="mt-1 text-xs text-gray-500">{item.size} · {item.category}</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-xs text-gray-500">Current stock</dt><dd className="mt-1 font-semibold text-red-600">{item.stock} units</dd></div>
            <div><dt className="text-xs text-gray-500">Reorder level</dt><dd className="mt-1 font-semibold text-gray-900">{item.reorderLevel} units</dd></div>
            <div><dt className="text-xs text-gray-500">Priority</dt><dd className="mt-1 font-semibold text-gray-900">{priority}</dd></div>
            <div><dt className="text-xs text-gray-500">Supplier</dt><dd className="mt-1 font-semibold text-gray-900">{item.supplier}</dd></div>
          </dl>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Close</button>
          <button type="button" onClick={() => onUpdate(item)} className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-800">Update Stock</button>
        </div>
      </section>
    </div>
  );
}

export default LowStockDetailsModal;
