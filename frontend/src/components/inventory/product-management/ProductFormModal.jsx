import { getStoreCategories } from '../../../services/api';
import ProductPhotoEditor from './ProductPhotoEditor';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

function ProductFormModal({ product, storeName, onClose, onSave }) {
  const isEditing = Boolean(product);
  const [form, setForm] = useState({
    product_name: product?.product_name ?? '',
    category_id: product?.category_id ?? '',
    selling_unit: product?.selling_unit ?? 'piece',
    barcode: product?.barcode ?? '',
    size: product?.size ?? '',
    selling_price: product?.selling_price ?? '',
    status: product?.status ?? 'inactive',
  });
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');
  const [errors, setErrors] = useState({});
  useEffect(() => { const controller = new AbortController(); getStoreCategories({ signal: controller.signal }).then(data => setCategories(data.categories)).catch(error => { if (error.name !== 'AbortError') setFailure(error.message); }); return () => controller.abort(); }, []);

  function change(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFailure('');
    setErrors({});
    try {
      await onSave({ ...form, barcode: form.barcode.trim() || null, size: form.size.trim() || null });
    } catch (error) {
      setErrors(error.errors || {});
      setFailure(error.status === 404
        ? 'This product is no longer in your assigned store. Close this form and refresh.'
        : error.status && error.status < 500
          ? error.message
          : 'Could not save this product. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-100 disabled:bg-gray-100';
  const fields = [
    ['product_name', 'Product name', 255, true, 'Example: Jasmine Rice'],
    ['barcode', 'Barcode (optional)', 64, false, 'Keep leading zeros'],
    ['size', 'Size (optional)', 100, false, 'Example: 1 kg'],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onKeyDown={(event) => { if (event.key === 'Escape' && !saving) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="product-form-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div><h2 id="product-form-title" className="text-lg font-bold text-gray-900">{isEditing ? 'Edit Product' : 'Add New Product'}</h2><p className="mt-1 text-xs text-gray-500">{storeName}</p></div>
          <button type="button" aria-label="Close product form" disabled={saving} onClick={onClose} className="rounded-md p-2 text-gray-500 disabled:opacity-50"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5">
          {failure && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{failure}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fields.map(([name, label, maxLength, required, placeholder]) => (
              <label key={name} className="block text-sm font-medium text-gray-700">{label}
                <input autoFocus={name === 'product_name'} name={name} value={form[name]} onChange={change} maxLength={maxLength} required={required} placeholder={placeholder} disabled={saving} className={inputClass} />
                {errors[name] && <span className="mt-1 block text-xs text-red-700">{errors[name][0]}</span>}
              </label>
            ))}
<label className="block text-sm font-medium text-gray-700">SKU<input readOnly value={product?.sku || 'Generated automatically after saving'} className={inputClass} /></label>
            <label className="block text-sm font-medium text-gray-700">Category<select required name="category_id" value={form.category_id} onChange={change} disabled={saving} className={inputClass}><option value="">Select a category</option>{categories.filter(c => c.active || c.id === product?.category_id).map(c => <option key={c.id} value={c.id}>{c.name}{c.active ? '' : ' (archived)'}</option>)}</select>{errors.category_id && <span className="text-xs text-red-700">{errors.category_id[0]}</span>}</label>
            <label className="block text-sm font-medium text-gray-700">Selling unit<select required name="selling_unit" value={form.selling_unit} onChange={change} disabled={saving} className={inputClass}>{['piece','pack','bottle','can','box','kilogram','gram','liter','milliliter'].map(unit => <option key={unit}>{unit}</option>)}</select>{errors.selling_unit && <span className="text-xs text-red-700">{errors.selling_unit[0]}</span>}</label>
            <label className="block text-sm font-medium text-gray-700">Selling price (PHP)
              <input name="selling_price" required type="number" min="0" max="99999999.99" step="0.01" value={form.selling_price} onChange={change} disabled={saving} className={inputClass} />
              {errors.selling_price && <span className="mt-1 block text-xs text-red-700">{errors.selling_price[0]}</span>}
            </label>
            <label className="block text-sm font-medium text-gray-700">Product status
              <select name="status" value={form.status} onChange={change} disabled={saving} className={inputClass}><option value="inactive">Inactive</option><option value="active">Active</option></select>
              {errors.status && <span className="mt-1 block text-xs text-red-700">{errors.status[0]}</span>}
            </label>
          </div>
          <p className="mt-4 text-xs text-gray-500">Product details and prices belong only to your assigned store. Stock quantities require Supervisor approval. Size describes the package (for example 1.5 L); the selling unit describes one ordered item (bottle). Quantities remain whole units.</p>
          <div className="mt-5 flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50">{saving ? 'Saving...' : isEditing ? 'Save Product' : 'Add Product'}</button>
          </div>
        </form>
        {product ? <ProductPhotoEditor product={product} /> : <p className="px-5 pb-5 text-sm text-slate-600">Save the product, then open Edit to upload its photo.</p>}
      </section>
    </div>
  );
}

export default ProductFormModal;
