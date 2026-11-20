import { useCallback, useEffect, useState } from 'react';
import { getPaymentOptions } from '../services/api';

export default function usePaymentOptions(storeId) {
  const [state, setState] = useState(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(current => current + 1), []);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);
  useEffect(() => {
    if (!storeId) return;
    const controller = new AbortController(); let active = true;
    getPaymentOptions(storeId, { signal: controller.signal }).then(result => {
      if (active && !controller.signal.aborted) setState({ ...result.digital, channels: result.digital?.channels ?? [], storeId, revision, loading: false });
    }).catch(error => { if (active && !controller.signal.aborted && error.name !== 'AbortError') setState({ storeId, revision, available: false, channels: [], loading: false, reason: error.message }); });
    return () => { active = false; controller.abort(); };
  }, [storeId, revision]);
  return { ...(state?.storeId === storeId && state.revision === revision ? state : { available: false, channels: [], loading: Boolean(storeId), reason: storeId ? 'Checking TEST payment availability...' : 'Choose a supermarket to check TEST payment availability.' }), refresh };
}
