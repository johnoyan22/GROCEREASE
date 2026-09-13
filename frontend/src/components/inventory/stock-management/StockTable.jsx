function getStockStatus(stock) {
  if (stock === 0) {
    return {
      label: "Out of Stock",
      color: "bg-red-50 text-red-600",
    };
  }

  if (stock <= 20) {
    return {
      label: "Low Stock",
      color: "bg-orange-50 text-orange-700",
    };
  }

  return {
    label: "In Stock",
    color: "bg-green-50 text-green-700",
  };
}

function StockTable({ items, onUpdate, onViewHistory }) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-xs">
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Product</th>
              <th scope="col" className="px-4 py-3 font-medium">SKU / Barcode</th>
              <th scope="col" className="px-4 py-3 font-medium">Category</th>
              <th scope="col" className="px-4 py-3 font-medium">Current Stock</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium">Availability</th>
              <th scope="col" className="px-4 py-3 font-medium">Last Updated</th>
              <th scope="col" className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 text-gray-700">
            {items.map((item) => {
              const stockStatus = getStockStatus(item.stock);

              return (
                <tr key={item.id} className="hover:bg-gray-50/70">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-10 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${item.thumbnailColor}`}>
                        {item.thumbnail}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="mt-0.5 text-[10px] text-gray-500">{item.size}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{item.sku}</p>
                    <p className="mt-0.5 text-[10px] text-gray-500">{item.barcode}</p>
                  </td>

                  <td className="px-4 py-3">{item.category}</td>

                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">{item.stock}</p>
                    <p className="mt-0.5 text-[10px] text-gray-400">units</p>
                  </td>

                  <td className="px-4 py-3">
                    <span className={`rounded-md px-2 py-1 text-[10px] font-medium ${stockStatus.color}`}>
                      {stockStatus.label}
                    </span>
                    <p className="mt-1.5 text-[10px] text-gray-400">Reorder at {item.reorderLevel}</p>
                  </td>

                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-gray-500">
                      <span className={`h-2 w-2 rounded-full ${item.stock > 0 ? "bg-green-600" : "bg-red-500"}`} />
                      {item.stock > 0 ? "Available" : "Unavailable"}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3">
                    <p>{item.lastUpdated}</p>
                    <p className="mt-0.5 text-[10px] text-gray-500">{item.updateTime}</p>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onUpdate(item)}
                        className="rounded-md border border-gray-200 px-2.5 py-2 font-medium text-green-700 hover:bg-green-50"
                      >
                        Update
                      </button>
                      <button
                        type="button"
                        onClick={() => onViewHistory(item)}
                        className="rounded-md border border-gray-200 px-2.5 py-2 font-medium text-blue-700 hover:bg-blue-50"
                      >
                        History
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {items.length === 0 && (
        <div className="px-4 py-12 text-center">
          <p className="font-medium text-gray-700">No stock items found</p>
          <p className="mt-1 text-xs text-gray-500">Try changing your search, tab, or filters.</p>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <p>Showing {items.length} stock item{items.length === 1 ? "" : "s"}</p>

        <div className="flex items-center gap-2">
          <button type="button" disabled className="rounded-md border border-gray-200 px-3 py-2 disabled:opacity-40">Previous</button>
          <button type="button" className="rounded-md bg-green-700 px-3 py-2 text-white">1</button>
          <button type="button" disabled className="rounded-md border border-gray-200 px-3 py-2 disabled:opacity-40">Next</button>
        </div>

        <select aria-label="Stock items per page" className="rounded-md border border-gray-200 bg-white px-3 py-2 outline-none focus:border-green-600">
          <option>10/page</option>
          <option>25/page</option>
          <option>50/page</option>
        </select>
      </div>
    </section>
  );
}

export default StockTable;
