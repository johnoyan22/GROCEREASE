import assert from 'node:assert/strict';
import { beforeEach, afterEach, test } from 'node:test';
import { selectShopperStore, getShopperRecommendations, askShopperAi, askShopperAiWithImage, getProductAlternatives, checkAiCartItem, getAiSettings, saveAiSettings } from '../src/services/habelApi.js';

let previousDocument;
beforeEach(() => {
  previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'XSRF-TOKEN=test%3Dtoken' } });
});
afterEach(() => { if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument); else delete globalThis.document; });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('AI reads use explicit selected-store paths, inventory IDs, session and cancellation without caching', async t => {
  const controller = new AbortController(), calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => { calls.push({ url, options }); return json({ data: [] }); });
  await getShopperRecommendations(2, [7], { signal: controller.signal }); await getProductAlternatives(2, 7, { signal: controller.signal }); await getAiSettings({ signal: controller.signal });
  assert.ok(calls[0].url.includes('/shopper/stores/2/ai-recommendations?cart_inventory_ids%5B%5D=7'));
  assert.ok(calls[1].url.endsWith('/alternatives/7'));
  for (const call of calls) { assert.equal(call.options.credentials, 'include'); assert.equal(call.options.signal, controller.signal); assert.equal(call.options.cache, 'no-store'); }
  assert.throws(() => getShopperRecommendations(null), /Select a supermarket/);
});

test('AI writes preserve CSRF and send only permitted data, never product prices as cart totals or actor overrides', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => { if (url.endsWith('/csrf-cookie')) return new Response(null, { status: 204 }); calls.push({ url, options }); return json({}); });
  await selectShopperStore(1); await askShopperAi(1, 'rice under 500');
  await checkAiCartItem(1, { store_inventory_id: 7, selling_price: '67.00', stock_version: 2, user_id: 999 }, 3);
  await saveAiSettings({ store_id: 1, enabled: true, max_items: 4, ranking_basis: 'hybrid', included_categories: [], excluded_categories: [], include_alternatives: false, updated_by: 999 });
  assert.deepEqual(JSON.parse(calls[0].options.body), { store_id: 1 });
  assert.deepEqual(JSON.parse(calls[1].options.body), { query: 'rice under 500' });
  assert.deepEqual(JSON.parse(calls[2].options.body), { quantity: 3, expected_price: '67.00', stock_version: 2 });
  assert.equal(JSON.parse(calls[3].options.body).updated_by, undefined);
  for (const call of calls) { assert.equal(call.options.headers['X-XSRF-TOKEN'], 'test=token'); assert.equal(call.options.credentials, 'include'); }
});

test('image upload sends multipart consent with no API key or manual content-type boundary', async t => {
  let upload;
  t.mock.method(globalThis, 'fetch', async (url, options) => { if (url.endsWith('/csrf-cookie')) return new Response(null, { status: 204 }); upload = options; return json({}); });
  await askShopperAiWithImage(1, new Blob(['image'], { type: 'image/png' }), 'under 500', { consent: true });
  assert.ok(upload.body instanceof FormData); assert.equal(upload.body.get('provider_consent'), '1');
  assert.equal(upload.body.get('note'), 'under 500'); assert.equal(upload.headers['Content-Type'], undefined);
  assert.equal(upload.headers['x-goog-api-key'], undefined);
});

test('CSRF failure prevents AI selection, text, photo and settings writes', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response(null, { status: 503 }); });
  await assert.rejects(selectShopperStore(1), /secure session/);
  await assert.rejects(askShopperAi(1, 'rice'), /secure session/);
  await assert.rejects(saveAiSettings({}), /secure session/);
  assert.equal(calls, 3);
});

test('AI authorization, stale context, limits and provider failures remain actionable errors', async t => {
  for (const status of [401, 403, 409, 422, 429, 503]) {
    t.mock.method(globalThis, 'fetch', async () => json({ message: 'Try again after review', errors: { query: ['Invalid query'] } }, status));
    await assert.rejects(getShopperRecommendations(1), error => error.status === status && error.errors.query[0] === 'Invalid query');
    t.mock.restoreAll();
  }
});
