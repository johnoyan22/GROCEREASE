import { useCallback, useEffect, useState } from 'react';
import { getAdminStaffAssignments } from '../services/api';

const initialState = { staff: [], stores: [], loading: true, error: '', errorStatus: null };

export default function useAdminStaff() {
  const [state, setState] = useState(initialState);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    getAdminStaffAssignments({ signal: controller.signal })
      .then((data) => {
        if (!Array.isArray(data.staff) || !Array.isArray(data.stores)) {
          throw new Error('Unexpected staff response.');
        }
        if (active) {
          setState({ staff: data.staff, stores: data.stores, loading: false, error: '', errorStatus: null });
        }
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') return;
        const message = error.status === 401
          ? 'Your session has expired. Please sign in again.'
          : error.status === 403
            ? 'Only an Admin can manage staff accounts and store assignments.'
            : 'Could not load staff and stores. Check your connection and retry.';
        setState({ staff: [], stores: [], loading: false, error: message, errorStatus: error.status });
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
