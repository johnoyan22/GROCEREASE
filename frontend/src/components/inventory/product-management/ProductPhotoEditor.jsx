import { useState } from 'react';
import { uploadProductPhoto, removeProductPhoto } from '../../../services/api';
import ProductImage from '../../shared/ProductImage';

export default function ProductPhotoEditor({ product }) {
  const [url, setUrl] = useState(product.image_url);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function save(remove = false) {
    setBusy(true); setMessage('');
    try {
      const result = remove ? await removeProductPhoto(product.store_inventory_id) : await uploadProductPhoto(product.store_inventory_id, file);
      setUrl(result.image_url); setFile(null); setPreview(''); setMessage(result.message);
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  function select(event) {
    const next = event.target.files?.[0];
    if (!next) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type) || next.size > 4 * 1024 * 1024) { setMessage('Choose a JPEG, PNG or WebP up to 4 MB.'); return; }
    setFile(next); const reader = new FileReader(); reader.onload = () => setPreview(reader.result); reader.readAsDataURL(next);
  }
  return <fieldset disabled={busy} className="space-y-3 border-t border-slate-200 p-5">
    <legend className="px-1 font-semibold">Product photo</legend>
    <ProductImage product={{ ...product, image_url: preview || url }} className="h-32 w-32" />
    <label className="block text-sm" htmlFor="product-photo">Use a team-owned or licensed JPEG, PNG or WebP, up to 4 MB.</label>
    <input id="product-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={select} className="w-full text-sm" />
    <div className="flex flex-wrap gap-3">{file && <><button type="button" onClick={() => save()} className="rounded-lg bg-green-800 px-4 py-2 text-sm text-white">Save photo</button><button type="button" onClick={() => { setFile(null); setPreview(''); }} className="rounded-lg border px-4 py-2 text-sm">Cancel photo</button></>}{url && <button type="button" onClick={() => save(true)} className="rounded-lg border px-4 py-2 text-sm">Remove photo</button>}</div>
    {message && <p role="status" className="text-sm">{message}</p>}
    <p className="text-xs text-slate-500">Photo changes are saved separately from product details and stock.</p>
  </fieldset>;
}
