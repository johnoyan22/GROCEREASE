import { useEffect, useRef, useState } from 'react';
import { createStoreMap } from '../../services/googleMaps';

export default function GoogleStoreMap({ stores, origin, onPick, onStoreSelect, selectedStoreId, apiKey, mapId }) {
  const container = useRef(null), adapter = useRef(null);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let active = true, owned;
    const previousAuthFailure = window.gm_authFailure;
    const authFailure = () => { if (active) setError('Google Maps is unavailable. Use a verified pickup area or the store list below.'); };
    window.gm_authFailure = authFailure;
    createStoreMap(container.current, { apiKey, mapId, onPick, onStoreSelect }).then(result => {
      owned = result; if (!active) { result.destroy(); return; } adapter.current = result; setReady(true);
    }).catch(() => { if (active) setError('Google Maps could not load. Use a verified pickup area or the store list below.'); });
    return () => { active = false; if (window.gm_authFailure === authFailure) window.gm_authFailure = previousAuthFailure; owned?.destroy(); adapter.current = null; };
  }, [apiKey, mapId, onPick, onStoreSelect]);
  useEffect(() => { if (ready) adapter.current?.setStores(stores); }, [ready, stores]);
  useEffect(() => { if (ready) adapter.current?.setOrigin(origin); }, [ready, origin]);
  useEffect(() => { if (ready) adapter.current?.selectStore(selectedStoreId); }, [ready, selectedStoreId, stores]);
  return <div className="space-y-2">{error ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}</p> : <>
    <div ref={container} aria-label="Google map. Choose an area or select a registered store marker." className="h-56 w-full overflow-hidden rounded-xl border border-slate-200 sm:h-72" />
    {!ready && <p role="status" className="text-sm text-slate-600">Loading Google Maps…</p>}
    {ready && <button type="button" onClick={() => { const center = adapter.current?.getCenter(); if (center) onPick(center); }} className="min-h-11 rounded-lg border border-green-800 px-3 text-sm font-semibold text-green-900">Use map center as my pin</button>}
    <p className="text-xs text-slate-600">Green pins are verified GrocerEase stores. Select one to preview its products. Other Google map labels do not indicate participation.</p>
  </>}</div>;
}
