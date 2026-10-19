import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { createCopOrder, getCheckoutQuote, findCheckoutAttempt, getShopperOrders, getStaffOrders, cancelShopperOrder, updateOrderStatus } from '../src/services/api.js';
import { clearCheckoutAttempt, readCheckoutAttempt, saveCheckoutAttempt } from '../src/services/checkout.js';

const schedule = { pickup_date: '2026-10-20', pickup_start: '15:00', pickup_end: '16:00' };
const cart = { ...schedule, store_id: 1, items: [{ store_inventory_id: 7, quantity: 2, price: 1 }] };
const key = '04a87418-5ada-4bee-9c35-3cb608cfa525';
let previousDocument;
beforeEach(function () {
  previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'XSRF-TOKEN=secure%3Dtoken' } });
});
afterEach(function () {
  if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
  else delete globalThis.document;
});

function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }); }

test('quote sends only selected store and item identities/quantities with CSRF and cancellation', async function (t) {
  const signal = new AbortController().signal;
  t.mock.method(globalThis, 'fetch', async function (url, options) {
    assert.equal(options.credentials, 'include');
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.equal(url, 'http://localhost:8000/api/shopper/checkout/quote');
    assert.equal(options.signal, signal);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['X-XSRF-TOKEN'], 'secure=token');
    assert.deepEqual(JSON.parse(options.body), { store_id: 1, items: [{ store_inventory_id: 7, quantity: 2 }], ...schedule });
    return json({ quote: { total_centavos: 13450, service_fee_centavos: 0 } });
  });
  await getCheckoutQuote({ ...cart, total: 1, payment_status: 'paid' }, { signal });
});

test('placement preserves the confirmation token and retry key, excluding client totals/payment claims', async function (t) {
  t.mock.method(globalThis, 'fetch', async function (url, options) {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.equal(url, 'http://localhost:8000/api/shopper/orders');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['X-XSRF-TOKEN'], 'secure=token');
    assert.deepEqual(JSON.parse(options.body), { store_id: 1, items: [{ store_inventory_id: 7, quantity: 2 }], ...schedule, quote_token: 'signed-review', idempotency_key: key });
    return json({ order: { order_id: 3, payment_status: 'unpaid' } }, 201);
  });
  assert.equal((await createCopOrder({ ...cart, total: 1, payment_status: 'paid' }, 'signed-review', key)).order.payment_status, 'unpaid');
});

test('tracking and recovery reads preserve credentials and explicit role endpoints', async function (t) {
  const signal = new AbortController().signal;
  const urls = [];
  t.mock.method(globalThis, 'fetch', async function (url, options) {
    urls.push(url); assert.equal(options.credentials, 'include'); assert.equal(options.signal, signal);
    return json({ orders: [] });
  });
  await getShopperOrders({ signal }); await getStaffOrders({ signal }); await findCheckoutAttempt(key, { signal });
  assert.deepEqual(urls, ['http://localhost:8000/api/shopper/orders', 'http://localhost:8000/api/staff/orders', 'http://localhost:8000/api/shopper/checkout-attempts/' + key]);
});

test('status and cancellation writes send no store, payment, or actor overrides', async function (t) {
  const bodies = [];
  t.mock.method(globalThis, 'fetch', async function (url, options) {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.equal(options.method, 'PUT'); assert.equal(options.headers['X-XSRF-TOKEN'], 'secure=token');
    bodies.push(JSON.parse(options.body)); return json({ message: 'Saved' });
  });
  await updateOrderStatus(3, 'preparing'); await cancelShopperOrder(3, 'Changed plan');
  assert.deepEqual(bodies, [{ status: 'preparing' }, { reason: 'Changed plan' }]);
});

test('HTTP price conflicts and validation failures remain errors for an explicit fresh review', async function (t) {
  let status = 409;
  t.mock.method(globalThis, 'fetch', async function (url) {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    return json({ message: 'Review current stock and prices.' }, status);
  });
  for (status of [401, 403, 409, 422, 503]) {
    await assert.rejects(createCopOrder(cart, 'token', key), function (error) { return error.status === status; });
  }
});

test('uncertain placement failures are never automatically retried', async function (t) {
  let placements = 0;
  t.mock.method(globalThis, 'fetch', async function (url) {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    placements++; throw new TypeError('Network unavailable');
  });
  await assert.rejects(createCopOrder(cart, 'token', key), /Network unavailable/);
  assert.equal(placements, 1);
});

test('CSRF setup failure prevents quote and transaction mutations', async function (t) {
  const fetch = t.mock.method(globalThis, 'fetch', async function (url) {
    assert.ok(url.endsWith('/sanctum/csrf-cookie')); return new Response(null, { status: 503 });
  });
  await assert.rejects(getCheckoutQuote(cart), /secure session/);
  await assert.rejects(createCopOrder(cart, 'token', key), /secure session/);
  await assert.rejects(cancelShopperOrder(3, 'Reason'), /secure session/);
  await assert.rejects(updateOrderStatus(3, 'preparing'), /secure session/);
  assert.equal(fetch.mock.callCount(), 4);
});

test('a saved checkout key is tied to the account, store, and normalized cart', function () {
  const values = new Map();
  const storage = { getItem: function (name) { return values.get(name) ?? null; }, setItem: function (name, value) { values.set(name, value); }, removeItem: function (name) { values.delete(name); } };
  saveCheckoutAttempt(storage, 5, cart, key);
  assert.deepEqual(readCheckoutAttempt(storage, 5, cart), { key, schedule });
  assert.equal(readCheckoutAttempt(storage, 6, cart), null);
  assert.equal(readCheckoutAttempt(storage, 5, { ...cart, store_id: 2 }), null);
  assert.equal(readCheckoutAttempt(storage, 5, { store_id: 1, items: [{ store_inventory_id: 7, quantity: 3 }] }), null);
  clearCheckoutAttempt(storage, 5, 'another-key');
  assert.deepEqual(readCheckoutAttempt(storage, 5, cart), { key, schedule });
  clearCheckoutAttempt(storage, 5, key);
  assert.equal(readCheckoutAttempt(storage, 5, cart), null);
});

test('corrupt checkout storage is not a confirmed order and storage errors prevent saving a retry key', function () {
  assert.equal(readCheckoutAttempt({ getItem: function () { return 'broken'; } }, 5, cart), null);
  assert.throws(function () { saveCheckoutAttempt({ setItem: function () { throw new Error('Storage unavailable'); } }, 5, cart, key); }, /Storage unavailable/);
});
