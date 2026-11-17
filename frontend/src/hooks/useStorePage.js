import { useCallback, useEffect, useState } from 'react';

export default function useStorePage(loader, query, polling = false) {
  const [revision, setRevision] = useState(0);
  const [response, setResponse] = useState({ key: '', data: null, error: '' });
  const queryKey = JSON.stringify(query);
  const key = queryKey + ':' + revision;
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    loader({ ...JSON.parse(queryKey), signal: controller.signal }).then((data) => {
      if (!data.store || !data.pagination || data.pagination.current_page < 1 || data.pagination.current_page > data.pagination.last_page) throw new Error('Unexpected response. Please retry.');
      if (active) setResponse({ key, data, error: '' });
    }).catch((error) => {
      if (active && error.name !== 'AbortError') setResponse({ key, data: null, error: error.message || 'Could not load this page.' });
    });
    return () => { active = false; controller.abort(); };
  }, [loader, queryKey, key]);
  useEffect(() => {
    if (!polling) return;
    const refresh = () => { if (document.visibilityState === 'visible') reload(); };
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => { window.removeEventListener('focus', refresh); window.clearInterval(timer); };
  }, [polling, reload]);
  const loading = response.key !== key;
  return { loading, data: loading ? null : response.data, store: response.data?.store ?? null,
    error: loading ? '' : response.error, reload };
}
