import { useCallback, useEffect, useState } from 'react';
import { getInventoryItems, getStockAdjustments, getLowStockReports, getAvailabilityHistory } from '../services/api';

const emptyState = { store: null, inventory: [], adjustments: [], reports: [], history: [], loading: true, error: '' };

export default function useStoreStock() {
  const [state, setState] = useState(emptyState);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadStock() {
      try {
        const options = { signal: controller.signal };
        const [items, requests, reports, history] = await Promise.all([
          getInventoryItems(options), getStockAdjustments(options), getLowStockReports(options), getAvailabilityHistory(options),
        ]);
        if (!items.store || !Array.isArray(items.inventory) || !Array.isArray(requests.adjustments)
          || !Array.isArray(reports.reports) || !Array.isArray(history.history)) {
          throw new Error('Unexpected stock response.');
        }
        // An Admin may transfer a staff member while these requests are in flight.
        if (items.store.store_id !== requests.store?.store_id || items.store.store_id !== reports.store?.store_id
          || items.store.store_id !== history.store?.store_id) {
          throw new Error('Your store assignment changed. Refresh this page.');
        }
        if (active) {
          setState({ store: items.store, inventory: items.inventory, adjustments: requests.adjustments,
            reports: reports.reports, history: history.history, loading: false, error: '' });
        }
      } catch (error) {
        if (active && error.name !== 'AbortError') {
          let message = error.message || 'Could not load stock. Please retry.';
          if (error.status === 401) {
            message = 'Your session expired. Please sign in again.';
          }
          setState({ ...emptyState, loading: false, error: message });
        }
      }
    }

    loadStock();
    return () => { active = false; controller.abort(); };
  }, [version]);

  const reload = useCallback(function () {
    setState(emptyState);
    setVersion(function (current) { return current + 1; });
  }, []);

  return { ...state, reload };
}
