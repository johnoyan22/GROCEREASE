// Optional real HTTP check against tests/ai-browser-sandbox.php only. No browser or Gemini calls.
import assert from 'node:assert/strict';

const base = 'http://127.0.0.1:8180';
const cookies = new Map();
let csrf = '';
async function request(path, { method = 'GET', body, status = 200 } = {}) {
  const headers = { Accept: 'application/json', Origin: 'http://127.0.0.1:5173', Referer: 'http://127.0.0.1:5173/',
    Cookie: [...cookies].map(([key, value]) => key + '=' + value).join('; ') };
  if (method !== 'GET') headers['X-XSRF-TOKEN'] = csrf;
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + path, { method, headers, ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}) });
  for (const entry of response.headers.getSetCookie()) {
    const pair = entry.split(';', 1)[0], index = pair.indexOf('=');
    cookies.set(pair.slice(0, index), pair.slice(index + 1));
  }
  csrf = decodeURIComponent(cookies.get('XSRF-TOKEN') ?? '');
  const data = await response.json().catch(() => ({}));
  assert.equal(response.status, status, path + ': ' + JSON.stringify(data));
  return data;
}
await request('/sanctum/csrf-cookie', { status: 204 });
await request('/api/shopper/stores/1/ai-recommendations', { status: 401 });
await request('/api/login', { method: 'POST', body: { email: 'ai-shopper@example.test', password: 'SandboxPass123!' } });
const { stores } = await request('/api/shopper/stores');
assert.deepEqual(stores.map(store => store.store_name), ['AI Test Store A', 'AI Test Store B'], 'Refusing non-sandbox data');
const a = stores[0].store_id, b = stores[1].store_id;
const ai = store => '/api/shopper/stores/' + store + '/ai-recommendations';
await request(ai(a), { status: 409 });
await request('/api/shopper/selected-store', { method: 'PUT', body: { store_id: a } });
const recommendations = await request(ai(a));
assert.ok(recommendations.data.length > 0 && recommendations.data.length <= 12);
assert.ok(recommendations.data.every(item => item.store_id === a && item.selling_price === '45.25'));
const ask = await request(ai(a) + '/ask', { method: 'POST', body: { query: 'Ingredients for spaghetti under 500' } });
assert.equal(ask.meta.understanding, 'keyword'); assert.equal(ask.data.total, 90.5);
const catalog = await request('/api/shopper/stores/' + a + '/products');
const alternatives = await request(ai(a) + '/alternatives/' + catalog.products.find(item => item.product_name === 'A Rice').store_inventory_id);
assert.equal(alternatives.data[0].name, 'A Brown Rice');
const item = recommendations.data[0];
await request(ai(a) + '/items/' + item.store_inventory_id + '/cart-check', { method: 'POST', body: { quantity: 1, expected_price: item.selling_price, stock_version: item.stock_version } });
await request(ai(a) + '/items/' + item.store_inventory_id + '/cart-check', { method: 'POST', status: 409, body: { quantity: 4, expected_price: item.selling_price, stock_version: item.stock_version } });
await request(ai(b), { status: 409 });
await request('/api/shopper/selected-store', { method: 'PUT', body: { store_id: b } });
const second = await request(ai(b));
assert.ok(second.data.every(row => row.store_id === b && row.selling_price === '99.00'));
const image = new FormData(); image.append('provider_consent', '1');
image.append('image', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'test.png');
await request(ai(b) + '/image', { method: 'POST', body: image, status: 503 });
await request('/api/logout', { method: 'POST' });
await request('/sanctum/csrf-cookie', { status: 204 });
await request('/api/login', { method: 'POST', body: { email: 'ai-supervisor@example.test', password: 'SandboxPass123!' } });
const settingsPath = '/api/supervisor/ai-recommendation/settings';
const settings = await request(settingsPath);
const pickupBefore = await request('/api/supervisor/pickup-settings');
const { enabled, ranking_basis, included_categories, excluded_categories, include_alternatives } = settings.data;
await request(settingsPath, { method: 'PUT', body: { enabled, ranking_basis, included_categories, excluded_categories, include_alternatives, max_items: 3, expected_store_id: a } });
const saved = await request(settingsPath); assert.equal(saved.data.max_items, 3); assert.equal(saved.audit.length, Math.min(settings.audit.length + 1, 10));
assert.deepEqual(await request('/api/supervisor/pickup-settings'), pickupBefore);
await request(settingsPath, { method: 'PUT', body: { enabled, ranking_basis, included_categories, excluded_categories, include_alternatives, max_items: settings.data.max_items, expected_store_id: a } });
await request('/api/logout', { method: 'POST' });
console.log('PASS: real sandbox HTTP session/CSRF, store isolation, keyword budgets, alternatives, cart checks, image unavailable, assigned settings persistence/audit and unchanged pickup settings. No browser or real Gemini test was executed.');
