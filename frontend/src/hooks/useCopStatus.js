import { useEffect, useState } from 'react';
import { getCopStatus } from '../services/api';

export default function useCopStatus() {
  const [result, setResult] = useState({ cop: null, loading: true, error: '' });
  useEffect(() => {
    let active = true;
    let controller;
    const load = () => {
      controller?.abort(); controller = new AbortController();
      const current = controller;
      getCopStatus({ signal: current.signal }).then(data => {
        if (active && !current.signal.aborted) setResult({ cop: data.cop, loading: false, error: '' });
      }).catch(error => { if (active && !current.signal.aborted && error.name !== 'AbortError') setResult({ cop: null, loading: false, error: error.message }); });
    };
    load(); window.addEventListener('focus', load);
    return () => { active = false; controller?.abort(); window.removeEventListener('focus', load); };
  }, []);
  return result;
}
