import { Pencil } from "lucide-react";

const moneyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

function formatUpdatedAt(value) {
  if (!value) return { date: "—", time: "" };

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

function ProductTable({ products, onEdit }) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-xs">
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
            {products.map((product) => {
              const updatedAt = formatUpdatedAt(product.updated_at);
              const availableStock = product.hard_stock_qty - (product.soft_stock_qty ?? 0);
              const availability = product.status === "Active" && availableStock > 0 ? "Available" : "Unavailable";

              return (
                <tr key={product.store_inventory_id ?? product.product_id} className="hover:bg-gray-50/70">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{product.product_name}</p>
                    <p className="mt-0.5 text-[10px] text-gray-500">{product.size}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{product.sku}</p>
                    <p className="mt-0.5 text-[10px] text-gray-500">{product.barcode}</p>
                  </td>
                  <td className="px-4 py-3">{product.category}</td>
                  <td className="px-4 py-3 font-medium">{moneyFormatter.format(product.selling_price)}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-800">{product.hard_stock_qty}</p>
                    <p className={`mt-0.5 text-[10px] ${getStockStyle(product.hard_stock_qty)}`}>
                      {getStockLabel(product.hard_stock_qty)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 ${availability === "Available" ? "text-green-700" : "text-red-600"}`}>
                      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${availability === "Available" ? "bg-green-600" : "bg-red-500"}`} />
                      {availability}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-1 text-[10px] ${product.status === "Active" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                      {product.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <p>{updatedAt.date}</p>
                    <p className="mt-0.5 text-[10px] text-gray-500">{updatedAt.time}</p>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" aria-label={`Edit ${product.product_name}`} onClick={() => onEdit(product)} className="rounded-lg border border-gray-200 p-2 text-gray-700 hover:bg-gray-50">
                      <Pencil size={14} aria-hidden="true" />
                    </button>
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