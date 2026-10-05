import { useState } from "react";

const emptyProduct = {
  product_name: "",
  sku: "",
  barcode: "",
  size: "",
  category: "Staples",
  base_price: "",
  selling_price: "",
  hard_stock_qty: "",
  soft_stock_qty: "0",
  status: "Active",
};

function ProductFormModal({ product, onClose, onSave }) {
  const [formData, setFormData] = useState(product || emptyProduct);
  const isEditing = Boolean(product);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    onSave({
      ...formData,
      base_price: Number(formData.base_price),
      selling_price: formData.selling_price === "" ? null : Number(formData.selling_price),
      hard_stock_qty: Number(formData.hard_stock_qty),
      soft_stock_qty: Number(formData.soft_stock_qty),
    });
  }

  const inputClass = "mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="product-form-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 id="product-form-title" className="text-lg font-bold text-gray-900">
              {isEditing ? "Edit Product" : "Add New Product"}
            </h2>
            <p className="mt-1 text-xs text-gray-500">Enter the product and store stock details below.</p>
          </div>
          <button type="button" aria-label="Close product form" onClick={onClose} className="rounded-md p-2 text-gray-500 hover:bg-gray-100">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">
              Product name
              <input required name="product_name" value={formData.product_name} onChange={handleChange} className={inputClass} />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Size
              <input required name="size" value={formData.size} onChange={handleChange} placeholder="Example: 1 kg" className={inputClass} />
            </label>
            <label className="text-sm font-medium text-gray-700">
              SKU
              <input required name="sku" value={formData.sku} onChange={handleChange} className={inputClass} />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Barcode
              <input required name="barcode" value={formData.barcode} onChange={handleChange} className={inputClass} />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Category
              <select name="category" value={formData.category} onChange={handleChange} className={inputClass}>
                <option>Staples</option>
                <option>Canned Goods</option>
                <option>Beverages</option>
                <option>Noodles</option>
                <option>Dairy</option>
                <option>Personal Care</option>
                <option>Household</option>
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              Base price
              <input required min="0" step="0.01" type="number" name="base_price" value={formData.base_price} onChange={handleChange} className={inputClass} />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Store selling price <span className="font-normal text-gray-400">(optional)</span>
              <input min="0" step="0.01" type="number" name="selling_price" value={formData.selling_price ?? ""} onChange={handleChange} className={inputClass} />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Physical stock
              <input required min="0" type="number" name="hard_stock_qty" value={formData.hard_stock_qty} onChange={handleChange} className={inputClass} />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Reserved stock
              <input required min="0" type="number" name="soft_stock_qty" value={formData.soft_stock_qty} onChange={handleChange} className={inputClass} />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Status
              <select name="status" value={formData.status} onChange={handleChange} className={inputClass}>
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-800">
              {isEditing ? "Save Changes" : "Add Product"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default ProductFormModal;