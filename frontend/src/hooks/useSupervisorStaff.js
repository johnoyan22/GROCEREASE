import { useCallback, useEffect, useState } from 'react';
import { getSupervisorStaff } from '../services/api';

const initialState = { store: null, staff: [], availableStaff: [], loading: true, error: '', errorStatus: null };

export default function useSupervisorStaff() {
  const [state, setState] = useState(initialState);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    getSupervisorStaff({ signal: controller.signal })
      .then((data) => {
        if (!data.store?.store_id || !Array.isArray(data.staff) || !Array.isArray(data.available_staff)) {
          throw new Error('Unexpected staff assignment response.');
        }
        if (active) {
          setState({ store: data.store, staff: data.staff, availableStaff: data.available_staff, loading: false, error: '', errorStatus: null });
        }
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') return;
        const message = error.status === 401
          ? 'Your session has expired. Please sign in again.'
          : error.status === 403
            ? 'You need an Admin-approved Supervisor account assigned to an active store. Contact Admin if your approval or store assignment needs updating.'
            : 'Could not load staff assignments. Check your connection and retry.';
        setState({ store: null, staff: [], availableStaff: [], loading: false, error: message, errorStatus: error.status });
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
