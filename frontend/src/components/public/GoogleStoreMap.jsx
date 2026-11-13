import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../../services/googleMaps';

export default function GoogleStoreMap({ stores, origin, onPick, apiKey, mapId }) {
  const container = useRef(null), instance = useRef(null), pin = useRef(null);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let active = true, click, drag;
    const markers = [];
    const previousAuthFailure = window.gm_authFailure;
    window.gm_authFailure = () => { if (active) setError('Google Maps is unavailable. Use your location below or try again later.'); };
    loadGoogleMaps(apiKey).then(async maps => {
      const [{ Map }, { AdvancedMarkerElement, PinElement }] = await Promise.all([maps.importLibrary('maps'), maps.importLibrary('marker')]);
      if (!active) return;
      const first = stores[0];
      const map = new Map(container.current, { mapId, center: first ? { lat: first.latitude, lng: first.longitude } : { lat: 12.8797, lng: 121.774 },
        zoom: first ? 12 : 5, streetViewControl: false, mapTypeControl: false, fullscreenControl: false, clickableIcons: false, gestureHandling: 'cooperative' });
      instance.current = map;
      for (const store of stores) {
        const icon = new PinElement({ background: '#006e00', borderColor: '#14532d', glyphColor: '#ffffff' });
        markers.push(new AdvancedMarkerElement({ map, position: { lat: store.latitude, lng: store.longitude }, title: store.store_name, content: icon }));
      }
      const userPin = new AdvancedMarkerElement({ map, title: 'Your chosen pickup area. Drag to change.', gmpDraggable: true });
      pin.current = userPin;
      click = map.addListener('click', event => { if (event.latLng) onPick(event.latLng.toJSON()); });
      drag = userPin.addListener('dragend', () => {
        const position = userPin.position;
        if (position) onPick(typeof position.toJSON === 'function' ? position.toJSON() : { lat: position.lat, lng: position.lng });
      });
      setReady(true);
    }).catch(() => { if (active) setError('Google Maps could not load. Use your location below or try again later.'); });
    return () => { active = false; window.gm_authFailure = previousAuthFailure; click?.remove(); drag?.remove(); for (const marker of markers) marker.map = null; if (pin.current) pin.current.map = null; instance.current = null; pin.current = null; };
  }, [apiKey, mapId, onPick, stores]);
  useEffect(() => {
    if (!ready || !origin || !instance.current || !pin.current) return;
    pin.current.position = origin;
    instance.current.panTo(origin);
  }, [origin, ready]);

  return <div className="space-y-2">
    {error ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}</p> : <>
      <div ref={container} aria-label="Google map. Click to choose your location, or move the map and use its center." className="h-64 w-full overflow-hidden rounded-xl border border-slate-200 sm:h-72" />
      {!ready && <p role="status" className="text-sm text-slate-600">Loading Google Maps…</p>}
      {ready && <button type="button" onClick={() => { const center = instance.current?.getCenter(); if (center) onPick(center.toJSON()); }} className="min-h-11 rounded-lg border border-green-800 px-3 text-sm font-semibold text-green-900">Use map center as my pin</button>}
      <p className="text-xs text-slate-600">Green pins are verified GrocerEase stores. Other Google map labels do not indicate participation.</p>
    </>}
  </div>;
}
