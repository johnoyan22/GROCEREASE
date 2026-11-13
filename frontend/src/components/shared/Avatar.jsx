import { initialsFor } from '../../services/identity';
import { useState } from 'react';

export default function Avatar({ profile, imageUrl, className = 'h-10 w-10' }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const showPhoto = imageUrl && failedUrl !== imageUrl;
  const name = [profile?.first_name ?? profile?.firstName, profile?.last_name ?? profile?.lastName].filter(Boolean).join(' ').trim();
  return <span role="img" aria-label={name ? `${name} avatar` : 'Account avatar'} className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-green-800 font-semibold text-white ${className}`}>
    {showPhoto ? <img key={imageUrl} src={imageUrl} alt="" className="h-full w-full object-cover" onError={() => setFailedUrl(imageUrl)} /> : null}
    <span className={showPhoto ? 'sr-only' : ''}>{initialsFor(profile)}</span>
  </span>;
}
