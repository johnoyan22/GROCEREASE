import { useCallback, useEffect, useRef, useState } from 'react';
import { findCheckoutAttempt, getShopperProducts, getShopperStores } from '../services/api';
import { cartFingerprint, cartSummary, changeCartQuantity, readSavedCart } from '../services/cart';
import { clearCheckoutAttempt, readCheckoutAttempt } from '../services/checkout';

// Mounted once inside the account-keyed Shopper workspace. Every cart surface uses this instance.
export default function useShopperCart(userId) {
  const [cart, setCart] = useState(() => readSavedCart(sessionStorage, userId));
  const latestCart = useRef(cart);
  const [stores, setStores] = useState([]);
  const [storesError, setStoresError] = useState('');
  const [storesLoading, setStoresLoading] = useState(true);
  const [catalog, setCatalog] = useState({ store: null, products: [], loading: Boolean(cart.store_id), error: '' });
  const [version, setVersion] = useState(0);
  const [recovery, setRecovery] = useState({ loading: true, error: '' });
  const [message, setMessage] = useState('');
  const storeId = cart.store_id;

  const orderPlaced = useCallback(function (order, key, submittedCart) {
    // Repeated recovery callbacks cannot clear a newer cart. Persistence is outside React state updaters.
    if (cartFingerprint(latestCart.current) !== cartFingerprint(submittedCart)) return;
    const cleared = { store_id: order.store_id, items: [] };
    try {
      sessionStorage.setItem('grocerease-cart-' + userId, JSON.stringify(cleared));
      clearCheckoutAttempt(sessionStorage, userId, key);
    } catch { /* Keep the recovery key if persistence failed. */ }
    latestCart.current = cleared;
    setCart(cleared);
    window.dispatchEvent(new Event('grocerease-data-changed'));
  }, [userId]);

  useEffect(function () {
    const controller = new AbortController();
    let active = true;
    const savedCart = readSavedCart(sessionStorage, userId);
    const attempt = readCheckoutAttempt(sessionStorage, userId, savedCart);
    async function recover() {
      try {
        if (attempt) {
          try {
            const result = await findCheckoutAttempt(attempt.key, { signal: controller.signal });
            if (active) orderPlaced(result.order, attempt.key, savedCart);
          } catch (error) {
            if (error.status !== 404) throw error;
            clearCheckoutAttempt(sessionStorage, userId, attempt.key);
          }
        }
        if (active) setRecovery({ loading: false, error: '' });
      } catch (error) {
        if (active && error.name !== 'AbortError') setRecovery({ loading: false, error: 'Check the previous checkout before editing this cart: ' + error.message });
      }
    }
    recover();
    return () => { active = false; controller.abort(); };
  }, [userId, orderPlaced, version]);

  useEffect(function () {
    const controller = new AbortController();
    let active = true;
    getShopperStores({ signal: controller.signal }).then(function (result) {
      if (!Array.isArray(result.stores)) throw new Error('Unexpected store response.');
      if (active) { setStores(result.stores); setStoresError(''); setStoresLoading(false); }
    }).catch(function (error) {
      if (active && error.name !== 'AbortError') { setStoresError(error.message); setStoresLoading(false); }
    });
    return () => { active = false; controller.abort(); };
  }, [version]);

  useEffect(function () {
    if (!storeId) return;
    const controller = new AbortController();
    let active = true;
    getShopperProducts(storeId, { signal: controller.signal }).then(function (result) {
      if (result.store?.store_id !== storeId || !Array.isArray(result.products)) throw new Error('Unexpected store products response.');
      if (active) setCatalog({ store: result.store, products: result.products, loading: false, error: '' });
    }).catch(function (error) {
      if (active && error.name !== 'AbortError') setCatalog({ store: null, products: [], loading: false, error: error.message });
    });
    return () => { active = false; controller.abort(); };
  }, [storeId, version]);

  useEffect(function () {
    try { sessionStorage.setItem('grocerease-cart-' + userId, JSON.stringify(cart)); }
    catch { /* The in-memory cart still works; checkout requires a persisted retry key. */ }
  }, [cart, userId]);

  const refresh = useCallback(function () {
    setStoresLoading(true); setStoresError('');
    setCatalog({ store: null, products: [], loading: Boolean(storeId), error: '' });
    setRecovery({ loading: true, error: '' });
    setVersion(current => current + 1);
  }, [storeId]);

  const locked = recovery.loading || Boolean(recovery.error);
  function switchStore(nextId) {
    if (locked) return;
    latestCart.current = { store_id: nextId, items: [] };
    setCart(latestCart.current);
    setCatalog({ store: null, products: [], loading: true, error: '' });
    setMessage('');
  }
  function changeQuantity(product, quantity) {
    if (locked || catalog.loading || catalog.error) return;
    try {
      latestCart.current = changeCartQuantity(latestCart.current, storeId, product, quantity);
      setCart(latestCart.current);
      setMessage('');
    } catch (error) { setMessage(error.message); }
  }
  function removeItem(itemId) {
    if (locked) return;
    latestCart.current = { ...latestCart.current, items: latestCart.current.items.filter(item => item.store_inventory_id !== itemId) };
    setCart(latestCart.current);
  }
  const summary = cartSummary(cart, catalog.products);
  const quantity = cart.items.reduce((total, item) => total + item.quantity, 0);
  const pricesAvailable = !catalog.loading && !catalog.error && summary.rows.every(row => row.product && !row.priceError);
  return { cart, storeId, stores, storesError, storesLoading, catalog, summary, quantity, pricesAvailable,
    message, recovery, locked, refresh, switchStore, changeQuantity, removeItem, orderPlaced };
}
