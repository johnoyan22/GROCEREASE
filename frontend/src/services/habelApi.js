// Habel's AI operations adapted to the foundation's session, CSRF and store conventions.
import { getXsrfToken } from './api.js';
const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8000/api';

async function request(path, { signal, method = 'GET', body } = {}) {
  const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = { Accept: 'application/json' };
  if (method !== 'GET') headers['X-XSRF-TOKEN'] = await getXsrfToken();
  if (body && !multipart) headers['Content-Type'] = 'application/json';
  const response = await fetch(API_URL + path, { method, credentials: 'include', cache: 'no-store', signal,
    headers, ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.message || 'The AI request failed.'); error.status = response.status; error.errors = data.errors || {}; throw error; }
  return data;
}
function storePath(storeId) {
  if (!Number.isSafeInteger(storeId) || storeId < 1) throw new Error('Select a supermarket first.');
  return '/shopper/stores/' + storeId + '/ai-recommendations';
}
export function selectShopperStore(storeId, { signal } = {}) {
  storePath(storeId);
  return request('/shopper/selected-store', { signal, method: 'PUT', body: { store_id: storeId } });
}
export function getShopperRecommendations(storeId, cartInventoryIds = [], { signal } = {}) {
  const params = new URLSearchParams(); cartInventoryIds.forEach(id => params.append('cart_inventory_ids[]', id));
  return request(storePath(storeId) + (params.size ? '?' + params : ''), { signal });
}
export function askShopperAi(storeId, query, { signal } = {}) {
  return request(storePath(storeId) + '/ask', { signal, method: 'POST', body: { query } });
}
export function askShopperAiWithImage(storeId, file, note = '', { signal, consent = false } = {}) {
  const body = new FormData(); body.append('image', file); body.append('note', note); body.append('provider_consent', consent ? '1' : '0');
  return request(storePath(storeId) + '/image', { signal, method: 'POST', body });
}
export function getProductAlternatives(storeId, inventoryId, { signal } = {}) {
  return request(storePath(storeId) + '/alternatives/' + encodeURIComponent(inventoryId), { signal });
}
export function checkAiCartItem(storeId, recommendation, quantity, { signal } = {}) {
  return request(storePath(storeId) + '/items/' + encodeURIComponent(recommendation.store_inventory_id) + '/cart-check', {
    signal, method: 'POST', body: { quantity, expected_price: recommendation.selling_price, stock_version: recommendation.stock_version } });
}
export function getAiSettings({ signal } = {}) { return request('/supervisor/ai-recommendation/settings', { signal }); }
export function saveAiSettings(settings, { signal } = {}) {
  const { enabled, max_items, ranking_basis, included_categories, excluded_categories, include_alternatives, store_id } = settings;
  return request('/supervisor/ai-recommendation/settings', { signal, method: 'PUT', body: { enabled, max_items, ranking_basis, included_categories, excluded_categories, include_alternatives, expected_store_id: store_id } });
}
