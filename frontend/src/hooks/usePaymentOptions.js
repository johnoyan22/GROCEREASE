import { useEffect, useState } from 'react';
import { getPaymentOptions } from '../services/api';

export default function usePaymentOptions(storeId) {
  const [state, setState] = useState({ available: false, channels: [], loading: Boolean(storeId), reason: 'Choose a supermarket to check sandbox availability.' });
  useEffect(() => {
    if (!storeId) return;
    const controller = new AbortController(); let active = true;
    getPaymentOptions(storeId, { signal: controller.signal }).then(result => {
      if (active) setState({ ...result.digital, loading: false });
    }).catch(error => { if (active && error.name !== 'AbortError') setState({ available: false, channels: [], loading: false, reason: error.message }); });
    return () => { active = false; controller.abort(); };
  }, [storeId]);
  return state;
}
