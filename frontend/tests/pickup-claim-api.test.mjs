import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { claimOrderPickup, getOrderSummary, lookupOrderReference, resolvePickup } from '../src/services/api.js';
let original;
beforeEach(() => { original = Object.getOwnPropertyDescriptor(globalThis, 'document'); Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'XSRF-TOKEN=qa' } }); });
afterEach(() => { if (original) Object.defineProperty(globalThis, 'document', original); else delete globalThis.document; });
const response = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
test('resolve posts one secret in the body with CSRF and no-store, preserving a leading-zero PIN', async t => {
  const signal = new AbortController().signal;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/sanctum/csrf-cookie')) return response({});
    assert.equal(url, 'http://localhost:8000/api/supervisor/pickup/resolve');
    assert.equal(options.credentials, 'include'); assert.equal(options.cache, 'no-store'); assert.equal(options.signal, signal); assert.equal(options.headers['X-XSRF-TOKEN'], 'qa');
    assert.deepEqual(JSON.parse(options.body), { method: 'pin', credential: '00123456', reference: 'GE-ORD-00000001' }); return response({});
  });
  await resolvePickup({ method: 'pin', credential: '00123456', reference: 'GE-ORD-00000001', store_id: 99, user_id: 22 }, { signal });
});
test('a QR preview sends no PIN or client order metadata and keeps explicit context for mismatch checks', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/sanctum/csrf-cookie')) return response({});
    assert.deepEqual(JSON.parse(options.body), { method: 'qr', credential: 'a'.repeat(64), order_context: 4 }); return response({});
  });
  await resolvePickup({ method: 'qr', credential: 'a'.repeat(64), pin: '00123456', order_context: 4, shopper_name: 'Client name' });
});
test('final claim sends actual booleans and representative details without amount, payment or actor overrides', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/sanctum/csrf-cookie')) return response({});
    assert.equal(url, 'http://localhost:8000/api/supervisor/orders/4/claim'); assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { method: 'pin', credential: '00123456', claiming_as: 'representative', claimant_name: 'Actual Person', identity_checked: false, physically_handed_over: false }); return response({});
  });
  await claimOrderPickup(4, { method: 'pin', credential: '00123456', claiming_as: 'representative', claimant_name: 'Actual Person', identity_checked: false, physically_handed_over: false, payment_status: 'paid', total_centavos: 1, verified_by_user_id: 9 });
});
test('self claim never posts a client-selected shopper name', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/sanctum/csrf-cookie')) return response({});
    assert.equal(JSON.parse(options.body).claimant_name, undefined); return response({});
  });
  await claimOrderPickup(4, { method: 'pin', credential: '00123456', claiming_as: 'shopper', claimant_name: 'Spoofed', identity_checked: true, physically_handed_over: true });
});
test('CSRF failure stops preview and final claim before any secret submission', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response(null, { status: 419 }); });
  await assert.rejects(resolvePickup({}), /secure session/); await assert.rejects(claimOrderPickup(1, {}), /secure session/); assert.equal(calls, 2);
});
test('exact reference and authorized summary reads use session, cancellation and no-store', async t => {
  const urls = [], signal = new AbortController().signal;
  t.mock.method(globalThis, 'fetch', async (url, options) => { urls.push(url); assert.equal(options.credentials, 'include'); assert.equal(options.cache, 'no-store'); assert.equal(options.signal, signal); return response({}); });
  await lookupOrderReference('GE-ORD-00000001', { signal }); await getOrderSummary(1, 'shopper', { signal }); await getOrderSummary(1, 'supervisor', { signal });
  assert.deepEqual(urls.map(url => new URL(url).pathname), ['/api/supervisor/order-reference', '/api/shopper/orders/1/summary', '/api/supervisor/orders/1/summary']);
});
