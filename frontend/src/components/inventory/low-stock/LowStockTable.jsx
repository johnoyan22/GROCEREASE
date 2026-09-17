function LowStockTable({ items, onView, onUpdate }) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">SKU / Barcode</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Current Stock</th>
              <th className="px-4 py-3 font-medium">Reorder Level</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Last Updated</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {items.map((item) => {
              const isCritical = item.stock <= 10;
              return (
                <tr key={item.id} className="hover:bg-gray-50/70">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-10 w-9 items-center justify-center rounded-md text-[10px] font-bold ${item.thumbnailColor}`}>{item.thumbnail}</span>
                      <div><p className="font-medium text-gray-900">{item.name}</p><p className="text-[10px] text-gray-500">{item.size}</p></div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><p className="font-medium">{item.sku}</p><p className="text-[10px] text-gray-500">{item.barcode}</p></td>
                  <td className="px-4 py-3">{item.category}</td>
                  <td className={`px-4 py-3 font-semibold ${isCritical ? "text-red-600" : "text-orange-600"}`}>{item.stock} units</td>
                  <td className="px-4 py-3">{item.reorderLevel} units</td>
                  <td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-medium ${isCritical ? "bg-red-50 text-red-600" : "bg-yellow-50 text-yellow-700"}`}>{isCritical ? "Critical" : "Low"}</span></td>
                  <td className="whitespace-nowrap px-4 py-3"><p>{item.lastUpdated}</p><p className="text-[10px] text-gray-500">{item.updateTime}</p></td>
                  <td className="px-4 py-3"><div className="flex gap-2"><button type="button" onClick={() => onView(item)} className="rounded-md border border-gray-200 px-3 py-2 text-blue-700 hover:bg-blue-50">View</button><button type="button" onClick={() => onUpdate(item)} className="rounded-md border border-green-200 px-3 py-2 text-green-700 hover:bg-green-50">Update</button></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {items.length === 0 && <div className="p-12 text-center text-sm text-gray-500">No low-stock items match your filters.</div>}
      <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <p>Showing {items.length} low-stock item{items.length === 1 ? "" : "s"}</p>
        <div className="flex gap-2"><button disabled className="rounded-md border px-3 py-2 opacity-40">Previous</button><button className="rounded-md bg-green-700 px-3 py-2 text-white">1</button><button disabled className="rounded-md border px-3 py-2 opacity-40">Next</button></div>
        <select aria-label="Items per page" className="rounded-md border border-gray-200 bg-white px-3 py-2"><option>10/page</option><option>25/page</option></select>
      </div>
    </section>
  );
}

export default LowStockTable;
