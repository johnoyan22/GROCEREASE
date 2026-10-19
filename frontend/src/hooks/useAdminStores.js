import { useCallback, useEffect, useState } from 'react';
import { getAdminStores } from '../services/api';

const initialState = { stores: [], loading: true, error: '', errorStatus: null };

export default function useAdminStores() {
  const [state, setState] = useState(initialState);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    getAdminStores({ signal: controller.signal })
      .then((data) => {
        if (!Array.isArray(data.stores)) throw new Error('Unexpected store response.');
        if (active) setState({ stores: data.stores, loading: false, error: '', errorStatus: null });
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') return;
        const message = error.status === 401
          ? 'Your session has expired. Please sign in again.'
          : error.status === 403
            ? 'Only an Admin can manage stores.'
            : 'Could not load stores. Check your connection and retry.';
        setState({ stores: [], loading: false, error: message, errorStatus: error.status });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [version]);

  const reload = useCallback(() => {
    setState(initialState);
    setVersion((current) => current + 1);
  }, []);

  return { ...state, reload };
}
