import { useCallback, useEffect, useState } from 'react';
import { getInventoryItems } from '../services/api';

const emptyInventory = { store: null, inventory: [], loading: true, error: '' };

export default function useStoreInventory() {
  const [state, setState] = useState(emptyInventory);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    getInventoryItems({ signal: controller.signal })
      .then((data) => {
        if (!data.store?.store_id || !Array.isArray(data.inventory)) {
          throw new Error('Unexpected inventory response.');
        }
        if (active) {
          setState({ store: data.store, inventory: data.inventory, loading: false, error: '' });
        }
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') return;
        const message = error.status === 403
          ? error.message
          : error.status === 401
            ? 'Your session has expired. Please sign in again.'
            : 'Could not load your store inventory. Check your connection and retry.';
        setState({ store: null, inventory: [], loading: false, error: message });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [version]);

  const reload = useCallback(() => {
    setState(emptyInventory);
    setVersion((current) => current + 1);
  }, []);

  return { ...state, reload };
}
