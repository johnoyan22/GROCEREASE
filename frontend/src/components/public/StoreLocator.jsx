import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LocateFixed, MapPin, Navigation } from 'lucide-react';
import { getPublicStoreLocations } from '../../services/api';
import { nearbyStores, directionsUrl, validPoint } from '../../services/storeLocator';
import GoogleStoreMap from './GoogleStoreMap';
const EMPTY_STORES = [];

export default function StoreLocator({ shopPath = '/login' }) {
  const [data, setData] = useState(null), [failure, setFailure] = useState('');
  const [origin, setOrigin] = useState(null), [radius, setRadius] = useState(10);
  const [loadMap, setLoadMap] = useState(false), [locating, setLocating] = useState(false), [locationError, setLocationError] = useState('');
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY, mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;
  useEffect(() => {
    const controller = new AbortController();
    getPublicStoreLocations({ signal: controller.signal }).then(setData).catch(error => { if (error.name !== 'AbortError') setFailure('We could not load store locations. Please try again later.'); });
    return () => controller.abort();
  }, []);
  const choosePoint = useCallback(point => { if (validPoint(point)) { setOrigin(point); setLocationError(''); } }, []);
  const stores = data?.stores || EMPTY_STORES;
  const canLoadMap = Boolean(apiKey && mapId && data?.available && stores.length > 0);
  const nearby = nearbyStores(stores, origin, radius);
  function locate() {
    if (!navigator.geolocation) { setLocationError('Your browser cannot share a location. Choose a pin on the map instead.'); return; }
    setLocating(true); setLocationError('');
    navigator.geolocation.getCurrentPosition(position => {
      choosePoint({ lat: position.coords.latitude, lng: position.coords.longitude }); setLocating(false);
    }, () => { setLocationError('Location could not be shared. You can choose a pin on the map instead.'); setLocating(false); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  }
  return <aside id="store-locator" aria-labelledby="store-locator-title" className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
    <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-900 text-white"><MapPin size={23} /></span><div><h2 id="store-locator-title" className="text-2xl font-bold text-green-900">Shop Near You.</h2><p className="mt-1 text-sm text-slate-600">Pick a location to find nearby stores registered in GrocerEase.</p></div></div>
    <div className="mt-4">
      {loadMap ? <GoogleStoreMap stores={stores} origin={origin} onPick={choosePoint} apiKey={apiKey} mapId={mapId} /> : <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border border-green-100 bg-green-50 p-4 text-center">
        <MapPin size={30} className="text-green-800" />
        <p className="text-sm text-green-950">{canLoadMap ? 'Choose your area on Google Maps.' : 'The interactive map is not available yet.'}</p>
        {canLoadMap && <><button type="button" onClick={() => setLoadMap(true)} className="ge-button px-4">Choose a map pin</button><p className="text-xs text-slate-600">Loading the map connects to Google Maps.</p></>}
      </div>}
    </div>
    {!data && !failure && <p role="status" className="mt-3 text-sm text-slate-600">Loading registered stores…</p>}
    {failure && <p role="alert" className="mt-3 text-sm text-red-700">{failure}</p>}
    {data && (!data.available || stores.length === 0) && <p role="status" className="mt-3 text-sm text-slate-600">{data.message || 'No verified store locations are listed yet. You can still choose a supermarket after signing in.'}</p>}
    {stores.length > 0 && <>
      <button type="button" onClick={locate} disabled={locating} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-green-800 px-3 text-sm font-semibold text-green-900 disabled:opacity-50"><LocateFixed size={17} />{locating ? 'Finding your location…' : 'Use my location'}</button>
      {locationError && <p role="alert" className="mt-2 text-sm text-red-700">{locationError}</p>}
      <label className="mt-3 flex items-center justify-between gap-2 text-sm text-slate-700">Search within<select value={radius} onChange={event => setRadius(Number(event.target.value))} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3">{[5, 10, 25, 50].map(value => <option key={value} value={value}>{value} km</option>)}</select></label>
      <div aria-live="polite" className="mt-3">
        {!origin ? <p className="text-sm text-slate-600">Choose a map pin or share your location to calculate nearby stores.</p> : <>
          <p className="text-sm font-semibold text-green-950">{nearby.length} registered {nearby.length === 1 ? 'store' : 'stores'} within {radius} km</p>
          <p className="mt-1 text-xs text-slate-600">Approximate straight-line distance from your pin; travel routes may be longer.</p>
          {nearby.length === 0 && <p className="mt-2 text-sm text-slate-600">No registered stores are within this range. Move your pin or increase the range.</p>}
          <ol className="mt-3 max-h-72 space-y-3 overflow-y-auto">{nearby.map((store, index) => <li key={store.store_id} className="rounded-lg border border-slate-200 p-3"><div className="flex items-start justify-between gap-2"><h3 className="break-words text-sm font-bold text-green-900">{store.store_name}</h3><span className="shrink-0 text-xs font-semibold text-green-800">{store.distance_km.toFixed(1)} km</span></div>{index === 0 && <p className="mt-1 text-xs font-semibold text-green-800">Nearest registered store</p>}<p className="mt-1 break-words text-xs text-slate-600">{store.address}</p><a href={directionsUrl(store, origin)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-green-800"><Navigation size={15} />Get directions<span className="sr-only"> to {store.store_name} in Google Maps (opens a new tab)</span></a></li>)}</ol>
        </>}
      </div>
      <p className="mt-3 text-xs text-slate-600">Your chosen location stays in this page and is not saved to your account. Google receives map interactions; directions open on Google Maps.</p>
    </>}
    <Link to={shopPath} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-green-800">Browse registered stores →</Link>
    <p className="mt-1 text-xs text-slate-500">Check products and pickup times inside your selected store.</p>
  </aside>;
}
