import { useState } from "react";

function StockUpdateModal({ items, product, onClose, onSave }) {
  const startingProduct = product || items[0];
  const [productId, setProductId] = useState(startingProduct.id);
  const [newQuantity, setNewQuantity] = useState(startingProduct.stock);
  const [reason, setReason] = useState("Physical stock count");

  const selectedItem = items.find((item) => item.id === Number(productId));
  const difference = Number(newQuantity) - selectedItem.stock;

  function handleProductChange(event) {
    const nextProductId = Number(event.target.value);
    const nextProduct = items.find((item) => item.id === nextProductId);

    setProductId(nextProductId);
    setNewQuantity(nextProduct.stock);
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSave(Number(productId), Number(newQuantity), reason);
  }

  const fieldClass = "mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="stock-update-title" className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 id="stock-update-title" className="text-lg font-bold text-gray-900">Update Stock Quantity</h2>
            <p className="mt-1 text-xs text-gray-500">Record the latest physical quantity for a product.</p>
          </div>
          <button type="button" aria-label="Close stock update form" onClick={onClose} className="rounded-md p-2 text-gray-500 hover:bg-gray-100">X</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <label className="block text-sm font-medium text-gray-700">
            Product
            <select value={productId} onChange={handleProductChange} className={fieldClass}>
              {items.map((item) => (
                <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Current stock</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{selectedItem.stock} units</p>
            </div>

            <label className="text-sm font-medium text-gray-700">
              New quantity
              <input required min="0" type="number" value={newQuantity} onChange={(event) => setNewQuantity(event.target.value)} className={fieldClass} />
            </label>
          </div>

          <div className={`rounded-lg p-3 text-sm ${difference === 0 ? "bg-gray-50 text-gray-600" : difference > 0 ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"}`}>
            Quantity change: <span className="font-semibold">{difference > 0 ? "+" : ""}{difference} units</span>
          </div>

          <label className="block text-sm font-medium text-gray-700">
            Reason for adjustment
            <select value={reason} onChange={(event) => setReason(event.target.value)} className={fieldClass}>
              <option>Physical stock count</option>
              <option>Received new delivery</option>
              <option>Damaged or expired items</option>
              <option>Correction of previous entry</option>
              <option>Other</option>
            </select>
          </label>

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-800">Save Stock Update</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default StockUpdateModal;
