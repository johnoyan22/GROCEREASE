import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';

export default function ProductImage({ product, className = 'h-36 w-full' }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const url = product?.image_url;
  return <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-green-50 text-green-800 ${className}`}>
    {url && failedUrl !== url ? <img src={url} alt={product.product_name || product.name || 'Product'} loading="lazy" decoding="async" className="h-full w-full object-contain" onError={() => setFailedUrl(url)} /> : <ShoppingBag aria-label="No product photo" role="img" className="h-8 w-8" />}
  </div>;
}
