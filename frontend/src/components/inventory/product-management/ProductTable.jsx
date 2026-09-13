function ProductTable({ products, onEdit }) {
  function getStockStyle(stock) {
    if (stock === 0) return "text-red-600";
    if (stock <= 20) return "text-orange-600";
    return "text-green-700";
  }

  function getStockLabel(stock) {
    if (stock === 0) return "Out of Stock";
    if (stock <= 20) return "Low Stock";
    return "In Stock";
  }

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Product</th>
              <th scope="col" className="px-4 py-3 font-medium">SKU / Barcode</th>
              <th scope="col" className="px-4 py-3 font-medium">Category</th>
              <th scope="col" className="px-4 py-3 font-medium">Price</th>
              <th scope="col" className="px-4 py-3 font-medium">Stock Quantity</th>
              <th scope="col" className="px-4 py-3 font-medium">Availability</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium">Last Updated</th>
              <th scope="col" className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 text-gray-700">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50/70">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-10 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${product.thumbnailColor}`}>
                      {product.thumbnail}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="mt-0.5 text-[10px] text-gray-500">{product.size}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{product.sku}</p>
                  <p className="mt-0.5 text-[10px] text-gray-500">{product.barcode}</p>
                </td>
                <td className="px-4 py-3">{product.category}</td>
                <td className="px-4 py-3">₱{Number(product.price).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-800">{product.stock}</p>
                  <p className={`mt-0.5 text-[10px] ${getStockStyle(product.stock)}`}>
                    {getStockLabel(product.stock)}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-gray-500">
                    <span className={`h-2 w-2 rounded-full ${product.availability === "Available" ? "bg-green-600" : "bg-red-500"}`} />
                    {product.availability}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-md px-2 py-1 text-[10px] font-medium ${product.status === "Active" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                    {product.status}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <p>{product.lastUpdated}</p>
                  <p className="mt-0.5 text-[10px] text-gray-500">{product.updateTime}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      aria-label={`Edit ${product.name}`}
                      onClick={() => onEdit(product)}
                      className="rounded-md border border-gray-200 px-2.5 py-2 text-blue-800 hover:bg-blue-50"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      aria-label={`More actions for ${product.name}`}
                      className="rounded-md border border-gray-200 px-2.5 py-2 text-gray-600 hover:bg-gray-100"
                    >
                      ⋮
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {products.length === 0 && (
        <div className="px-4 py-12 text-center">
          <p className="font-medium text-gray-700">No products found</p>
          <p className="mt-1 text-xs text-gray-500">Try changing your search or filters.</p>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <p>Showing {products.length} product{products.length === 1 ? "" : "s"}</p>

        <div className="flex items-center gap-2">
          <button type="button" disabled className="rounded-md border border-gray-200 px-3 py-2 disabled:opacity-40">‹</button>
          <button type="button" className="rounded-md bg-green-700 px-3 py-2 text-white">1</button>
          <button type="button" disabled className="rounded-md border border-gray-200 px-3 py-2 disabled:opacity-40">›</button>
        </div>

        <select aria-label="Products per page" className="rounded-md border border-gray-200 bg-white px-3 py-2 outline-none focus:border-green-600">
          <option>10/page</option>
          <option>25/page</option>
          <option>50/page</option>
        </select>
      </div>
    </section>
  );
}

export default ProductTable;
