export function validPoint(point) {
  return point != null && typeof point.lat === 'number' && typeof point.lng === 'number'
    && Number.isFinite(point.lat) && Number.isFinite(point.lng)
    && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}

export function distanceKm(a, b) {
  if (!validPoint(a) || !validPoint(b)) return null;
  const radians = degrees => degrees * Math.PI / 180;
  const latitude = radians(b.lat - a.lat), longitude = radians(b.lng - a.lng);
  const haversine = Math.sin(latitude / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(longitude / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, haversine))));
}

export function nearbyStores(stores, origin, radius = 10) {
  if (!validPoint(origin) || !Number.isFinite(radius) || radius <= 0) return [];
  return stores.map(store => ({ ...store, distance_km: distanceKm(origin, { lat: store.latitude, lng: store.longitude }) }))
    .filter(store => store.distance_km !== null && store.distance_km <= radius)
    .sort((a, b) => a.distance_km - b.distance_km || a.store_id - b.store_id);
}

export function directionsUrl(store, origin) {
  const destination = { lat: store.latitude, lng: store.longitude };
  if (!validPoint(destination)) return null;
  const query = new URLSearchParams({ api: '1', destination: `${destination.lat},${destination.lng}` });
  if (validPoint(origin)) query.set('origin', `${origin.lat},${origin.lng}`);
  return 'https://www.google.com/maps/dir/?' + query;
}
