import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getCategoryOptions } from '../../../services/api';
import useModalFocus from '../../../hooks/useModalFocus';

function ProductFormModal({ product, storeName, onClose, onSave }) {
  const isEditing = Boolean(product);
  const dialog = useRef(null);
  useModalFocus(dialog, () => { if (!saving) onClose(); });
  const [categoryResponse, setCategoryResponse] = useState(null);
  const [categoryRevision, setCategoryRevision] = useState(0);
  const categoryKey = String(categoryRevision);
  const categories = categoryResponse?.key === categoryKey ? categoryResponse : null;
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    getCategoryOptions({ signal: controller.signal }).then((data) => {
      if (!Array.isArray(data.categories) || !data.store || (product && data.store.store_id !== product.store_id)) throw new Error('Your store assignment changed. Close the form and refresh.');
      if (active) setCategoryResponse({ key: categoryKey, options: data.categories });
    }).catch((e) => { if (active && e.name !== 'AbortError') setCategoryResponse({ key: categoryKey, error: e.message }); });
    return () => { active = false; controller.abort(); };
  }, [categoryKey, product]);
  const [form, setForm] = useState({
    product_name: product?.product_name ?? '',
    barcode: product?.barcode ?? '',
    size_amount: product?.size_amount ?? '',
    size_unit: product?.size_unit ?? '',
    selling_unit: product?.selling_unit ?? (product ? '' : 'piece'),
    category_id: product?.category_id ?? '',
    selling_price: product?.selling_price ?? '',
    status: product?.status ?? 'inactive',
  });
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');
  const [errors, setErrors] = useState({});
  const legacySize = Boolean(product?.size && !product?.size_unit);
  const [replaceLegacy, setReplaceLegacy] = useState(false);

  function change(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (saving || !categories?.options || (!form.category_id && !isEditing)) return;
    setSaving(true);
    setFailure('');
    setErrors({});
    try {
      const details = { ...form, barcode: form.barcode.trim() || null,
        size_amount: form.size_unit ? form.size_amount : null, size_unit: form.size_unit || null };
      if (isEditing && !form.category_id) delete details.category_id;
      if (legacySize && !replaceLegacy) { delete details.size_amount; delete details.size_unit; }
      await onSave(details);
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

  const inputClass = 'mt-1 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-100 disabled:bg-gray-100';
  const fields = [
    ['product_name', 'Product name', 255, true, 'Example: Jasmine Rice'],
    ['barcode', 'Barcode (optional)', 64, false, 'Keep leading zeros'],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="product-form-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div><h2 id="product-form-title" className="text-lg font-bold text-gray-900">{isEditing ? 'Edit Product' : 'Add New Product'}</h2><p className="mt-1 text-xs text-gray-500">{storeName}</p></div>
          <button type="button" aria-label="Close product form" disabled={saving} onClick={onClose} className="rounded-md p-2 text-gray-500 disabled:opacity-50"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5">
          {failure && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{failure}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-gray-700">SKU<input readOnly value={product?.sku ?? 'Generated automatically'} className={inputClass + ' bg-gray-50'} /></label>
            {fields.map(([name, label, maxLength, required, placeholder]) => (
              <label key={name} className="block text-sm font-medium text-gray-700">{label}
                <input data-initial-focus={name === 'product_name' ? '' : undefined} name={name} value={form[name]} onChange={change} maxLength={maxLength} required={required} placeholder={placeholder} disabled={saving} className={inputClass} />
                {errors[name] && <span className="mt-1 block text-xs text-red-700">{errors[name][0]}</span>}
              </label>
            ))}
            <div className="text-sm font-medium text-gray-700">
              <label>Category<select aria-label="Category" name="category_id" required={!isEditing || Boolean(product.category_id)} value={form.category_id} onChange={change} disabled={saving || !categories?.options} className={inputClass}>
                <option value="" disabled={Boolean(product?.category_id)}>{isEditing && !product.category_id ? `Legacy category: ${product.category || 'Unmapped'} (needs review)` : 'Select a category'}</option>
                {product?.category_id && categories?.options && !categories.options.some((c) => String(c.id) === String(product.category_id)) && <option value={product.category_id}>{product.category} (Inactive; current selection)</option>}
                {(categories?.options ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></label>
              {!categories && <p role="status" className="mt-1 text-xs">Loading categories...</p>}
              {categories?.error && <p role="alert" className="mt-1 text-xs text-red-700">{categories.error}<button type="button" onClick={() => setCategoryRevision((n) => n + 1)} className="ml-2 underline">Retry categories</button></p>}
              {categories?.options?.length === 0 && <p className="mt-1 text-xs text-amber-800">No active categories. Your Supervisor must add or activate a category before you can assign one to a new product.</p>}
              {errors.category_id && <p className="mt-1 text-xs text-red-700">{errors.category_id[0]}</p>}
            </div>
            <div className="text-sm font-medium text-gray-700 sm:col-span-2">
              {legacySize && <p className="mb-2 rounded bg-amber-50 p-2 text-xs text-amber-900">Existing size: {product.size}. Kept as recorded until you explicitly replace it. <label className="block mt-2"><input type="checkbox" checked={replaceLegacy} onChange={(event) => setReplaceLegacy(event.target.checked)} /> Replace existing size</label></p>}
              <label htmlFor="size-amount">Size of one selling unit</label>
              <div className="flex gap-2">
                <input id="size-amount" aria-label="Size amount" type="number" name="size_amount" value={form.size_amount} onChange={change} min="0.0001" max="99999999.9999" step="0.0001" required={Boolean(form.size_unit)} disabled={saving || !form.size_unit || (legacySize && !replaceLegacy)} className={inputClass} />
                <select aria-label="Unit of Measure" name="size_unit" value={form.size_unit} onChange={(event) => { change(event); if (!event.target.value) setForm((current) => ({ ...current, size_amount: '' })); }} disabled={saving || (legacySize && !replaceLegacy)} className={inputClass}>
                  <option value="">Not applicable (count only)</option>
                  {[['mg', 'Milligrams (mg)'], ['g', 'Grams (g)'], ['kg', 'Kilograms (kg)'], ['mL', 'Millilitres (mL)'], ['L', 'Litres (L)']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              {(errors.size_amount || errors.size_unit || errors.size) && <p className="text-xs text-red-700">{[...(errors.size_amount ?? []), ...(errors.size_unit ?? []), ...(errors.size ?? [])].join(' ')}</p>}
              <p className="mt-1 text-xs font-normal text-gray-500">Contents of one selling unit. Stock and checkout count whole selling units.</p>
            </div>
            <label className="block text-sm font-medium text-gray-700">Sold as
              <select required name="selling_unit" value={form.selling_unit} onChange={change} disabled={saving} className={inputClass}><option value="">Confirm selling unit</option>{['piece', 'bottle', 'can', 'pack', 'bag'].map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select>
              {errors.selling_unit && <span className="text-xs text-red-700">{errors.selling_unit[0]}</span>}
              {product && !product.selling_unit && <p className="text-xs text-amber-800">Legacy selling unit unconfigured. Confirm the correct unit when saving.</p>}
            </label>
            <label className="block text-sm font-medium text-gray-700">Selling price (PHP)
              <input name="selling_price" required type="number" min="0" max="99999999.99" step="0.01" value={form.selling_price} onChange={change} disabled={saving} className={inputClass} />
              {errors.selling_price && <span className="mt-1 block text-xs text-red-700">{errors.selling_price[0]}</span>}
            </label>
            <label className="block text-sm font-medium text-gray-700">Product status
              <select name="status" value={form.status} onChange={change} disabled={saving} className={inputClass}><option value="inactive">Inactive</option><option value="active">Active</option></select>
              {errors.status && <span className="mt-1 block text-xs text-red-700">{errors.status[0]}</span>}
            </label>
          </div>
          <p className="mt-4 text-xs text-gray-500">Product details and prices belong only to your assigned store. Stock quantities require Supervisor approval.</p>
          <div className="mt-5 flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving || !categories?.options || (!isEditing && (!form.category_id || categories.options.length === 0))} className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50">{saving ? 'Saving...' : isEditing ? 'Save Product' : 'Add Product'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default ProductFormModal;
