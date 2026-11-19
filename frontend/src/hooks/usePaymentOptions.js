import { useEffect, useState } from 'react';
import { getPaymentOptions } from '../services/api';

export default function usePaymentOptions(storeId) {
  const [state, setState] = useState(null);
  useEffect(() => {
    if (!storeId) return;
    const controller = new AbortController(); let active = true;
    getPaymentOptions(storeId, { signal: controller.signal }).then(result => {
      if (active) setState({ ...result.digital, storeId, loading: false });
    }).catch(error => { if (active && error.name !== 'AbortError') setState({ storeId, available: false, channels: [], loading: false, reason: error.message }); });
    return () => { active = false; controller.abort(); };
  }, [storeId]);
  return state?.storeId === storeId ? state : { available: false, channels: [], loading: Boolean(storeId), reason: storeId ? 'Checking TEST payment availability...' : 'Choose a supermarket to check TEST payment availability.' };
}
