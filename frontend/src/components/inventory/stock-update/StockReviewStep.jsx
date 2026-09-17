function StockReviewStep({ products, quantities }) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3"><h3 className="font-semibold text-gray-900">Review stock changes</h3><p className="mt-1 text-xs text-gray-500">Confirm the quantities before submitting.</p></div>
      <div className="divide-y divide-gray-100">
        {products.map((product) => {
          const newQuantity = Number(quantities[product.id]);
          const difference = newQuantity - product.stock;
          return (
            <div key={product.id} className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <div><p className="text-sm font-medium text-gray-900">{product.name}</p><p className="text-xs text-gray-500">{product.sku}</p></div>
              <p className="text-sm text-gray-600">{product.stock} → <span className="font-semibold text-gray-900">{newQuantity} units</span></p>
              <span className={`w-fit rounded-md px-2 py-1 text-xs font-semibold ${difference >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{difference > 0 ? "+" : ""}{difference}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default StockReviewStep;
