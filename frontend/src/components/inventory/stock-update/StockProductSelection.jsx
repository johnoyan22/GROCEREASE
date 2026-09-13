function StockProductSelection({ products, selectedIds, onToggle }) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
            <tr><th className="w-12 px-4 py-3"><span className="sr-only">Select</span></th><th className="px-4 py-3 font-medium">Product</th><th className="px-4 py-3 font-medium">SKU / Barcode</th><th className="px-4 py-3 font-medium">Category</th><th className="px-4 py-3 font-medium">Current Stock</th><th className="px-4 py-3 font-medium">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {products.map((product) => {
              const isSelected = selectedIds.includes(product.id);
              const status = product.stock <= 10 ? "Critical" : product.stock <= 20 ? "Low Stock" : "Available";
              return (
                <tr key={product.id} className={isSelected ? "bg-green-50/40" : ""}>
                  <td className="px-4 py-3"><input type="checkbox" checked={isSelected} onChange={() => onToggle(product.id)} aria-label={`Select ${product.name}`} className="h-4 w-4 accent-green-700" /></td>
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><span className={`flex h-10 w-9 items-center justify-center rounded-md text-[10px] font-bold ${product.thumbnailColor}`}>{product.thumbnail}</span><div><p className="font-medium text-gray-900">{product.name}</p><p className="text-[10px] text-gray-500">{product.size}</p></div></div></td>
                  <td className="px-4 py-3"><p className="font-medium">{product.sku}</p><p className="text-[10px] text-gray-500">{product.barcode}</p></td>
                  <td className="px-4 py-3">{product.category}</td>
                  <td className="px-4 py-3"><p className="font-semibold text-gray-900">{product.stock} units</p></td>
                  <td className={`px-4 py-3 font-medium ${status === "Critical" ? "text-red-600" : status === "Low Stock" ? "text-orange-600" : "text-green-700"}`}>{status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {products.length === 0 && <p className="px-4 py-10 text-center text-sm text-gray-500">No products match the filters.</p>}
    </section>
  );
}

export default StockProductSelection;
