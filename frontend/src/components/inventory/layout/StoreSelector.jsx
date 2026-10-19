import { useEffect, useState } from 'react';
import { getAssignedStore } from '../../../services/api';

function StoreSelector({ store, loading = false, error = '' }) {
  const supplied = store !== undefined;
  const [loaded, setLoaded] = useState({ store: null, loading: true, error: '' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (supplied) return;
    const controller = new AbortController();
    let active = true;
    getAssignedStore({ signal: controller.signal })
      .then((data) => {
        if (active) setLoaded({ store: data.store, loading: false, error: '' });
      })
      .catch((failure) => {
        if (!active || failure.name === 'AbortError') return;
        setLoaded({
          store: null,
          loading: false,
          error: failure.status === 403 ? failure.message : 'Could not load your assigned store.',
        });
      });
    return () => { active = false; controller.abort(); };
  }, [supplied, version]);

  const display = supplied ? { store, loading, error } : loaded;
  function retry() {
    setLoaded({ store: null, loading: true, error: '' });
    setVersion((current) => current + 1);
  }

  return (
    <div className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left md:w-72">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 text-sm font-bold text-green-700">S</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-700">Assigned store</p>
        {display.loading ? <p className="mt-1 text-xs text-gray-500">Loading store...</p> : display.store ? (
          <>
            <p className="mt-1 truncate text-sm font-semibold text-green-800" title={display.store.store_name}>{display.store.store_name}</p>
            <p className="truncate text-xs text-gray-500" title={display.store.address}>{display.store.address}</p>
          </>
        ) : (
          <>
            <p className="mt-1 text-xs text-red-700">{supplied ? 'Store unavailable' : display.error || 'No assigned store'}</p>
            {!supplied && <button type="button" onClick={retry} className="mt-1 text-xs font-semibold text-green-700 underline">Retry</button>}
          </>
        )}
      </div>
    </div>
  );
}

export default StoreSelector;
