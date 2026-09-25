const moneyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

function formatUpdatedAt(value) {
  if (!value) {
    return { date: "—", time: "" };
  }

  const updatedAt = new Date(value);

  return {
    date: updatedAt.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    time: updatedAt.toLocaleTimeString("en-PH", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function ProductTable({ products }) {
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
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Product</th>
              <th scope="col" className="px-4 py-3 font-medium">Category</th>
              <th scope="col" className="px-4 py-3 font-medium">Base Cost</th>
              <th scope="col" className="px-4 py-3 font-medium">Selling Price</th>
              <th scope="col" className="px-4 py-3 font-medium">Physical Stock</th>
              <th scope="col" className="px-4 py-3 font-medium">Reserved Stock</th>
              <th scope="col" className="px-4 py-3 font-medium">Availability</th>
              <th scope="col" className="px-4 py-3 font-medium">Last Updated</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 text-gray-700">
            {products.map((product) => {
              const updatedAt = formatUpdatedAt(product.updated_at);

              return (
                <tr key={product.store_inventory_id} className="hover:bg-gray-50/70">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{product.product_name}</p>
                    <p className="mt-0.5 text-[10px] text-gray-500">Product #{product.product_id}</p>
                  </td>
                  <td className="px-4 py-3">{product.category}</td>
                  <td className="px-4 py-3">{moneyFormatter.format(product.base_cost)}</td>
                  <td className="px-4 py-3 font-medium">{moneyFormatter.format(product.selling_price)}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-800">{product.hard_stock_qty}</p>
                    <p className={`mt-0.5 text-[10px] ${getStockStyle(product.hard_stock_qty)}`}>
                      {getStockLabel(product.hard_stock_qty)}
                    </p>
                  </td>
                  <td className="px-4 py-3">{product.soft_stock_qty}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-gray-500">
                      <span className={`h-2 w-2 rounded-full ${product.availability === "Available" ? "bg-green-600" : "bg-red-500"}`} />
                      {product.availability}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p>{updatedAt.date}</p>
                    <p className="mt-0.5 text-[10px] text-gray-500">{updatedAt.time}</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {products.length === 0 && (
        <div className="px-4 py-12 text-center">
          <p className="font-medium text-gray-700">No products found</p>
          <p className="mt-1 text-xs text-gray-500">This store has no matching inventory products.</p>
        </div>
      )}

      <div className="border-t border-gray-100 px-4 py-4 text-xs text-gray-500">
        Showing {products.length} product{products.length === 1 ? "" : "s"}
      </div>
    </section>
  );
}

export default ProductTable;
