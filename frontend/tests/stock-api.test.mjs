import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  getStockAdjustments, getLowStockReports, getAvailabilityHistory,
  submitStockAdjustment, submitLowStockReport, decideStockAdjustment, updateInventoryPolicy,
} from '../src/services/api.js';

let previousDocument;
beforeEach(function () {
  previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'XSRF-TOKEN=secure%3Dtoken' } });
});
afterEach(function () {
  if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
  else delete globalThis.document;
});

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

test('all stock reads use session authentication, explicit endpoints, and abort signals', async function (t) {
  const signal = new AbortController().signal;
  const paths = [];
  t.mock.method(globalThis, 'fetch', async function (url, options) {
    paths.push(url);
    assert.equal(options.credentials, 'include');
    assert.equal(options.signal, signal);
    assert.equal(options.headers.Accept, 'application/json');
    return json({ store: { store_id: 1 } });
  });
  await getStockAdjustments({ signal });
  await getLowStockReports({ signal });
  await getAvailabilityHistory({ signal });
  assert.deepEqual(paths, [
    'http://localhost:8000/api/inventory/stock-adjustments',
    'http://localhost:8000/api/inventory/low-stock-reports',
    'http://localhost:8000/api/inventory/availability-history',
  ]);
});

test('count requests send desired count and optimistic version, excluding trusted snapshot fields', async function (t) {
  t.mock.method(globalThis, 'fetch', async function (url, options) {
    assert.equal(options.credentials, 'include');
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.equal(url, 'http://localhost:8000/api/inventory/items/7/stock-adjustments');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['X-XSRF-TOKEN'], 'secure=token');
    assert.deepEqual(JSON.parse(options.body), { requested_hard_stock_qty: '92', expected_stock_version: 2, reason: 'Physical count' });
    return json({ adjustment: { status: 'pending' } }, 201);
  });
  const result = await submitStockAdjustment(7, {
    requested_hard_stock_qty: '92', expected_stock_version: 2, reason: 'Physical count',
    store_id: 999, requested_by_user_id: 999, status: 'approved', observed_hard_stock_qty: 999,
  });
  assert.equal(result.adjustment.status, 'pending');
});

test('low-stock reports send only a note with CSRF protection', async function (t) {
  t.mock.method(globalThis, 'fetch', async function (url, options) {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.equal(url, 'http://localhost:8000/api/inventory/items/7/low-stock-reports');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['X-XSRF-TOKEN'], 'secure=token');
    assert.deepEqual(JSON.parse(options.body), { note: 'Nearly empty shelf' });
    return json({ message: 'Recorded' }, 201);
  });
  await submitLowStockReport(7, 'Nearly empty shelf');
});

test('decisions send no actor, store, or quantity override', async function (t) {
  t.mock.method(globalThis, 'fetch', async function (url, options) {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.equal(url, 'http://localhost:8000/api/supervisor/stock-adjustments/4/decision');
    assert.equal(options.method, 'PUT');
    assert.equal(options.headers['X-XSRF-TOKEN'], 'secure=token');
    assert.deepEqual(JSON.parse(options.body), { decision: 'rejected', decision_note: 'Please recount' });
    return json({ message: 'Rejected' });
  });
  await decideStockAdjustment(4, 'rejected', 'Please recount');
});

test('policies preserve explicit null settings and exclude quantity fields', async function (t) {
  t.mock.method(globalThis, 'fetch', async function (url, options) {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.equal(url, 'http://localhost:8000/api/supervisor/inventory/items/7/policy');
    assert.equal(options.method, 'PUT');
    assert.equal(options.headers['X-XSRF-TOKEN'], 'secure=token');
    assert.deepEqual(JSON.parse(options.body), { max_per_order: null, low_stock_threshold: 0 });
    return json({ message: 'Saved' });
  });
  await updateInventoryPolicy(7, { max_per_order: null, low_stock_threshold: 0, hard_stock_qty: 999, store_id: 999 });
});

test('stale and duplicate decision errors retain their 409 status', async function (t) {
  t.mock.method(globalThis, 'fetch', async function (url) {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    return json({ message: 'Stock changed after this request.' }, 409);
  });
  await assert.rejects(decideStockAdjustment(4, 'approved', ''), function (error) {
    assert.equal(error.status, 409);
    assert.match(error.message, /Stock changed/);
    return true;
  });
});

test('validation messages reach correction forms', async function (t) {
  t.mock.method(globalThis, 'fetch', async function (url) {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    return json({ message: 'Count below reservations.', errors: { requested_hard_stock_qty: ['Reconciliation required.'] } }, 422);
  });
  await assert.rejects(submitStockAdjustment(7, {}), function (error) {
    assert.equal(error.status, 422);
    assert.deepEqual(error.errors.requested_hard_stock_qty, ['Reconciliation required.']);
    return true;
  });
});

test('failed CSRF setup prevents all stock writes', async function (t) {
  const fetch = t.mock.method(globalThis, 'fetch', async function (url) {
    assert.ok(url.endsWith('/sanctum/csrf-cookie'));
    return new Response(null, { status: 503 });
  });
  await assert.rejects(submitStockAdjustment(7, {}), /secure session/);
  await assert.rejects(submitLowStockReport(7, 'Low'), /secure session/);
  await assert.rejects(decideStockAdjustment(4, 'approved', ''), /secure session/);
  await assert.rejects(updateInventoryPolicy(7, {}), /secure session/);
  assert.equal(fetch.mock.callCount(), 4);
});

test('unauthorized and missing-schema responses never become successful empty lists', async function (t) {
  let status = 401;
  t.mock.method(globalThis, 'fetch', async function () { return json({ message: 'Unavailable' }, status); });
  for (status of [401, 403, 503]) {
    await assert.rejects(getStockAdjustments(), function (error) { return error.status === status; });
    await assert.rejects(getLowStockReports(), function (error) { return error.status === status; });
  }
});
