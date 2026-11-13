import { useCallback, useEffect, useMemo, useState } from 'react';
import { LocateFixed, MapPin, Navigation } from 'lucide-react';
import { getPublicStoreLocations } from '../../services/api';
import { nearbyStores, directionsUrl, validPoint } from '../../services/storeLocator';
import GoogleStoreMap from './GoogleStoreMap';
const EMPTY_STORES = [];

export default function StoreLocator({ selectedStoreId, onStoreSelect, mapConfig }) {
  const [data, setData] = useState(null), [failure, setFailure] = useState(''), [version, setVersion] = useState(0);
  const [origin, setOrigin] = useState(null), [draft, setDraft] = useState(null), [radius, setRadius] = useState(10);
  const [localSelection, setLocalSelection] = useState(null), [search, setSearch] = useState('');
  const [loadMap, setLoadMap] = useState(false), [locating, setLocating] = useState(false), [locationError, setLocationError] = useState('');
  const apiKey = mapConfig?.apiKey ?? import.meta.env.VITE_GOOGLE_MAPS_API_KEY, mapId = mapConfig?.mapId ?? import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    getPublicStoreLocations({ signal: controller.signal }).then(result => { if (active) setData(result); }).catch(error => { if (active && error.name !== 'AbortError') setFailure('We could not load store locations. Please try again.'); });
    return () => { active = false; controller.abort(); };
  }, [version]);
  const choosePoint = useCallback(point => { if (validPoint(point)) { setDraft(point); setLocationError(''); } }, []);
  const chooseStore = useCallback(store => { setLocalSelection(store?.store_id ?? null); onStoreSelect?.(store); if (store) window.requestAnimationFrame?.(() => document.getElementById('public-store-' + store.store_id)?.scrollIntoView({ block: 'nearest' })); }, [onStoreSelect]);
  const stores = data?.stores || EMPTY_STORES;
  const selectedId = selectedStoreId ?? localSelection;
  const nearby = useMemo(() => origin ? nearbyStores(stores, origin, radius) : stores, [stores, origin, radius]);
  const filtered = useMemo(() => nearby.filter(store => (store.store_name + ' ' + store.address).toLowerCase().includes(search.trim().toLowerCase())), [nearby, search]);
  function confirmArea() { if (!draft) return; setOrigin(draft); setDraft(null); chooseStore(null); }
  function locate() {
    if (!navigator.geolocation) { setLocationError('Location sharing is not supported. Choose a verified pickup area or a map pin instead.'); return; }
    setLocating(true); setLocationError('');
    navigator.geolocation.getCurrentPosition(position => { choosePoint({ lat: position.coords.latitude, lng: position.coords.longitude }); setLocating(false); },
      () => { setLocationError('Location could not be shared. Choose a verified pickup area or a map pin instead.'); setLocating(false); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  }
  function preview(store) { chooseStore(store); window.requestAnimationFrame?.(() => document.getElementById('public-catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }
  return <aside id="store-locator" aria-labelledby="store-locator-title" className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
    <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-900 text-white"><MapPin size={23} /></span><div><h2 id="store-locator-title" className="text-2xl font-bold text-green-900">Shop Near You.</h2><p className="mt-1 text-sm text-slate-600">Choose an area or browse verified stores without signing in.</p></div></div>
    <div className="mt-4">{loadMap ? <GoogleStoreMap stores={filtered} origin={draft || origin} onPick={choosePoint} onStoreSelect={chooseStore} selectedStoreId={selectedId} apiKey={apiKey} mapId={mapId} /> : <div className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border border-green-100 bg-green-50 p-4 text-center"><MapPin size={28} className="text-green-800" /><p className="text-sm text-green-950">{apiKey && mapId ? 'Pick your area on Google Maps.' : 'The interactive map is not available yet. Browse verified stores below.'}</p>{apiKey && mapId && <><button type="button" onClick={() => setLoadMap(true)} className="ge-button">Choose a map pin</button><p className="text-xs text-slate-600">Loading the map connects to Google Maps.</p></>}</div>}</div>
    {!data && !failure && <p role="status" className="mt-3 text-sm text-slate-600">Loading registered stores…</p>}
    {failure && <div role="alert" className="mt-3 text-sm text-red-700"><p>{failure}</p><button type="button" onClick={() => { setFailure(''); setVersion(current => current + 1); }} className="min-h-11 font-semibold underline">Retry store locations</button></div>}
    {data && stores.length === 0 && <p role="status" className="mt-3 text-sm text-slate-600">No verified stores are available for public browsing yet.</p>}
    <button type="button" onClick={locate} disabled={locating} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-green-800 px-3 text-sm font-semibold text-green-900 disabled:opacity-50"><LocateFixed size={17} />{locating ? 'Finding your location…' : 'Use my location'}</button>
    {locationError && <p role="alert" className="mt-2 text-sm text-red-700">{locationError}</p>}
    {stores.length > 0 && <label className="mt-3 block text-sm font-medium">Choose a verified pickup area<select defaultValue="" onChange={event => { const store = stores.find(item => String(item.store_id) === event.target.value); if (store) choosePoint({ lat: store.latitude, lng: store.longitude }); }} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm"><option value="">Select a registered store's area</option>{stores.map(store => <option key={store.store_id} value={store.store_id}>{store.address} · {store.store_name}</option>)}</select></label>}
    {draft && <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3"><p className="text-sm text-green-950">Your selected area is ready. Confirm it to update nearby stores.</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={confirmArea} className="ge-button">Confirm selected area</button><button type="button" onClick={() => setDraft(null)} className="min-h-11 rounded-lg border border-green-800 px-3 text-sm">Cancel area change</button></div></div>}
    {stores.length > 0 && <><label className="mt-3 flex items-center justify-between gap-2 text-sm text-slate-700">Search within<select value={radius} onChange={event => { setRadius(Number(event.target.value)); chooseStore(null); }} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3">{[5, 10, 25, 50].map(value => <option key={value} value={value}>{value} km</option>)}</select></label>
      <label className="mt-3 block text-sm font-medium">Search registered stores or addresses<input type="search" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
      <div aria-live="polite" className="mt-3"><p className="text-sm font-semibold text-green-950">{origin ? nearby.length + ' registered ' + (nearby.length === 1 ? 'store' : 'stores') + ' within ' + radius + ' km' : 'Verified registered stores'}</p><p className="mt-1 text-xs text-slate-600">{origin ? 'Approximate straight-line distance from your confirmed pin; travel routes may be longer.' : 'Choose and confirm an area for distances, or preview a store now.'}</p>
        {filtered.length === 0 && <p className="mt-3 text-sm text-slate-600">No registered stores match this area and search. Move your pin, increase the range or clear your search.</p>}
        <ol className="mt-3 max-h-80 space-y-3 overflow-y-auto">{filtered.map((store, index) => <li key={store.store_id} id={'public-store-' + store.store_id} data-store-id={store.store_id} className={'rounded-lg border p-3 ' + (selectedId === store.store_id ? 'border-green-800 bg-green-50 ring-1 ring-green-800' : 'border-slate-200')}><button type="button" aria-label={'Select store ' + store.store_name} aria-pressed={selectedId === store.store_id} onClick={() => chooseStore(store)} className="flex min-h-11 w-full items-start justify-between gap-2 text-left"><span className="break-words text-sm font-bold text-green-900">{store.store_name}</span>{origin && <span className="shrink-0 text-xs font-semibold text-green-800">{store.distance_km.toFixed(1)} km</span>}</button>{origin && index === 0 && store.store_id === nearby[0]?.store_id && <p className="text-xs font-semibold text-green-800">Nearest registered store</p>}<p className="mt-1 break-words text-xs text-slate-600">{store.address}</p><button type="button" onClick={() => preview(store)} className="mt-3 w-full rounded-lg bg-green-800 px-3 py-2.5 text-sm font-semibold text-white">View Available Products<span className="sr-only"> at {store.store_name}</span></button><a href={directionsUrl(store, origin)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-green-800"><Navigation size={15} />Get directions<span className="sr-only"> to {store.store_name} in Google Maps (opens a new tab)</span></a></li>)}</ol>
      </div></>}
    <p className="mt-4 text-xs text-slate-600">Your chosen area stays in temporary page state. Google receives map interactions and directions requests. Search here uses verified GrocerEase records, not address geocoding.</p>
  </aside>;
}
