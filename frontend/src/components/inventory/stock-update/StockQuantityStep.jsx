function StockQuantityStep({ products, quantities, onQuantityChange }) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-xs">
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-500"><tr><th className="px-4 py-3 font-medium">Product</th><th className="px-4 py-3 font-medium">Current Stock</th><th className="px-4 py-3 font-medium">New Quantity</th><th className="px-4 py-3 font-medium">Difference</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {products.map((product) => {
              const newQuantity = quantities[product.id];
              const difference = Number(newQuantity) - product.stock;
              return (
                <tr key={product.id}>
                  <td className="px-4 py-3"><p className="font-medium text-gray-900">{product.name}</p><p className="text-[10px] text-gray-500">{product.sku}</p></td>
                  <td className="px-4 py-3">{product.stock} units</td>
                  <td className="px-4 py-3"><input required min="0" type="number" value={newQuantity} onChange={(event) => onQuantityChange(product.id, event.target.value)} className="w-32 rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100" /></td>
                  <td className={`px-4 py-3 font-semibold ${difference > 0 ? "text-green-700" : difference < 0 ? "text-red-600" : "text-gray-500"}`}>{difference > 0 ? "+" : ""}{difference}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default StockQuantityStep;
