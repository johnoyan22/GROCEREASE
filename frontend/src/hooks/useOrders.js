import { useCallback, useEffect, useState } from 'react';
import { getShopperOrders, getStaffOrders, getStoreWorkers, getCopStatus, getOrderNotifications } from '../services/api';

const emptyState = { store: null, orders: [], workers: [], cop: null, notifications: [], asOf: 0, loading: true, error: '' };

export default function useOrders(role) {
  const [state, setState] = useState(emptyState);
  const [version, setVersion] = useState(0);

  useEffect(function () {
    const controller = new AbortController();
    let active = true;
    async function loadOrders() {
      try {
        let result;
        let workers = [];
        let cop = null;
        let notifications = [];
        if (role === 'shopper') {
          const responses = await Promise.all([getShopperOrders({ signal: controller.signal }), getCopStatus({ signal: controller.signal }), getOrderNotifications({ signal: controller.signal })]);
          result = responses[0]; cop = responses[1].cop; notifications = responses[2].notifications;
        } else if (role === 'supervisor') {
          const responses = await Promise.all([getStaffOrders({ signal: controller.signal }), getStoreWorkers({ signal: controller.signal })]);
          result = responses[0];
          if (result.store?.store_id !== responses[1].store?.store_id) throw new Error('Your store assignment changed. Refresh orders.');
          workers = responses[1].workers;
        } else result = await getStaffOrders({ signal: controller.signal });
        if (!Array.isArray(result.orders)) throw new Error('Unexpected order response.');
        if (role !== 'shopper' && !result.store?.store_id) throw new Error('Your store could not be resolved.');
        if (active) setState({ store: result.store ?? null, orders: result.orders, workers, cop, notifications, asOf: Date.parse(result.server_time), loading: false, error: '' });
      } catch (error) {
        if (active && error.name !== 'AbortError') setState({ ...emptyState, loading: false, error: error.message });
      }
    }
    loadOrders();
    return function () { active = false; controller.abort(); };
  }, [role, version]);

  const reload = useCallback(function () {
    setState(emptyState);
    setVersion(function (current) { return current + 1; });
  }, []);
  return { ...state, reload };
}
