import { useCallback, useEffect, useState } from 'react';
import { getDashboardSummary } from '../services/api';

export default function useDashboardSummary(role, refreshKey = '') {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => {
    setState({ data: null, loading: true, error: '' });
    setVersion(current => current + 1);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getDashboardSummary({ signal: controller.signal }).then(data => {
      if (data.role !== role) throw new Error('Your account role changed. Sign in again.');
      if (active) setState({ data, loading: false, error: '' });
    }).catch(error => {
      if (active && error.name !== 'AbortError') setState({ data: null, loading: false, error: error.message });
    });
    return () => { active = false; controller.abort(); };
  }, [role, refreshKey, version]);
  useEffect(() => {
    window.addEventListener('grocerease-data-changed', reload);
    window.addEventListener('focus', reload);
    const timer = window.setInterval(reload, 60000);
    return () => {
      window.removeEventListener('grocerease-data-changed', reload);
      window.removeEventListener('focus', reload);
      window.clearInterval(timer);
    };
  }, [reload]);
  return { ...state, reload };
}
