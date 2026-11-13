let pending;
export function loadGoogleMaps(key) {
  if (!key) return Promise.reject(new Error('The interactive map is not available yet.'));
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => { window.clearTimeout(timer); script.remove(); delete window.__grocerEaseMapsReady; pending = undefined; reject(new Error('Google Maps could not load. You can still use your location to find registered stores.')); };
    const timer = window.setTimeout(fail, 20000);
    window.__grocerEaseMapsReady = () => { window.clearTimeout(timer); delete window.__grocerEaseMapsReady; resolve(window.google.maps); };
    script.src = 'https://maps.googleapis.com/maps/api/js?' + new URLSearchParams({ key, v: 'quarterly', loading: 'async', libraries: 'marker', callback: '__grocerEaseMapsReady' });
    script.async = true; script.onerror = fail;
    document.head.appendChild(script);
  });
  return pending;
}

// The SDK owns these mutable map/marker instances; React keeps only this adapter.
export async function createStoreMap(element, { apiKey, mapId, onPick, onStoreSelect }) {
  const maps = await loadGoogleMaps(apiKey);
  const [{ Map: GoogleMap }, { AdvancedMarkerElement, PinElement }] = await Promise.all([maps.importLibrary('maps'), maps.importLibrary('marker')]);
  const map = new GoogleMap(element, { mapId, center: { lat: 12.8797, lng: 121.774 }, zoom: 5,
    streetViewControl: false, mapTypeControl: false, fullscreenControl: false, clickableIcons: false, gestureHandling: 'cooperative' });
  let records = new Map();
  const userPin = new AdvancedMarkerElement({ map, title: 'Your chosen area. Drag to change, then confirm.', gmpDraggable: true, zIndex: 1000000 });
  const click = map.addListener('click', event => { if (event.latLng) onPick(event.latLng.toJSON()); });
  const drag = userPin.addListener('dragend', () => { const point = userPin.position; if (point) onPick(typeof point.toJSON === 'function' ? point.toJSON() : { lat: point.lat, lng: point.lng }); });
  function clearStores() { for (const record of records.values()) { record.listener.remove(); record.marker.map = null; } records = new Map(); }
  return {
    setStores(stores) {
      clearStores();
      for (const store of stores) {
        const icon = new PinElement({ background: '#006e00', borderColor: '#14532d', glyphColor: '#ffffff' });
        const marker = new AdvancedMarkerElement({ map, position: { lat: store.latitude, lng: store.longitude }, title: store.store_name, content: icon, gmpClickable: true });
        records.set(store.store_id, { marker, icon, listener: marker.addListener('click', () => onStoreSelect?.(store)) });
      }
      if (!userPin.position && stores[0]) { map.panTo({ lat: stores[0].latitude, lng: stores[0].longitude }); map.setZoom?.(12); }
    },
    setOrigin(point) { userPin.position = point || null; if (point) { map.panTo(point); map.setZoom?.(12); } },
    selectStore(id) {
      for (const [storeId, record] of records) { const selected = storeId === id; record.icon.scale = selected ? 1.25 : 1; record.icon.background = selected ? '#14532d' : '#006e00'; record.marker.zIndex = selected ? 10 : 1; }
      const selected = records.get(id); if (selected) map.panTo(selected.marker.position);
    },
    getCenter() { return map.getCenter()?.toJSON(); },
    destroy() { clearStores(); click.remove(); drag.remove(); userPin.map = null; },
  };
}
