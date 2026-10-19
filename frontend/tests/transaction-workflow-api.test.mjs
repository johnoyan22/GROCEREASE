import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { assignOrderWorker, closeStorePickupDate, completeOrderPreparation, confirmOrderResale, correctCopStrike, getCopStatus, getCopStrikes, getOrderNotifications, getOrderReceipt, getPickupHours, getStorePickupSettings, getTransactionRecords, readOrderNotification, requestOrderRefundReview, rescheduleOrder, saveOrderPreparation, saveStorePickupSettings } from '../src/services/api.js';

let previousDocument;
beforeEach(function () {
  previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'XSRF-TOKEN=workflow' } });
});
afterEach(function () {
  if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
  else delete globalThis.document;
});
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }); }
function recordWrites(t) {
  const writes = [];
  t.mock.method(globalThis, 'fetch', async function (url, options) {
    assert.equal(options.credentials, 'include');
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.equal(options.headers['X-XSRF-TOKEN'], 'workflow');
    writes.push({ path: url.replace('http://localhost:8000/api', ''), method: options.method, body: JSON.parse(options.body) });
    return json({ message: 'Saved' });
  });
  return writes;
}

test('store-specific hours reads preserve session and abort, including the chosen Philippine-local date', async function (t) {
  const urls = [];
  const signal = new AbortController().signal;
  t.mock.method(globalThis, 'fetch', async function (url, options) { urls.push(url); assert.equal(options.signal, signal); assert.equal(options.credentials, 'include'); return json({}); });
  await getStorePickupSettings(2, { signal }); await getPickupHours(2, '2026-10-20', { signal });
  assert.deepEqual(urls, ['http://localhost:8000/api/admin/stores/2/pickup-settings', 'http://localhost:8000/api/shopper/stores/2/pickup-hours?date=2026-10-20']);
});

test('store settings preserve an explicit missing holding policy and closure audit reason', async function (t) {
  const writes = recordWrites(t);
  await saveStorePickupSettings(2, { 1: null }, null); await closeStorePickupDate(2, '2026-10-20', 'Power outage');
  assert.deepEqual(writes, [{ path: '/admin/stores/2/pickup-settings', method: 'PUT', body: { operating_hours: { 1: null }, paid_order_holding_hours: null } },
    { path: '/admin/stores/2/pickup-closures', method: 'POST', body: { date: '2026-10-20', reason: 'Power outage' } }]);
});

test('worker delegation, checklist and review are separate writes with server-owned actors and order state', async function (t) {
  const writes = recordWrites(t);
  await assignOrderWorker(3, 7, 'Shift change'); await saveOrderPreparation(3, [{ order_item_id: 9, prepared_qty: 2, price: 1, prepared_by_user_id: 999 }]); await completeOrderPreparation(3, 'Reviewed');
  assert.deepEqual(writes, [{ path: '/supervisor/orders/3/worker', method: 'PUT', body: { worker_id: 7, reason: 'Shift change' } },
    { path: '/staff/orders/3/preparation', method: 'PUT', body: { items: [{ order_item_id: 9, prepared_qty: 2 }] } },
    { path: '/supervisor/orders/3/preparation-completion', method: 'PUT', body: { completion_note: 'Reviewed' } }]);
});

test('reschedule and resale send only the approved schedule and explicit disposition confirmation', async function (t) {
  const writes = recordWrites(t);
  const selection = { pickup_date: '2026-10-20', pickup_start: '15:00', pickup_end: '16:00' };
  await rescheduleOrder(3, { ...selection, store_id: 999, status: 'completed' }, 'Approved change'); await confirmOrderResale(3, 'All sealed goods checked');
  assert.deepEqual(writes[0].body, { ...selection, reason: 'Approved change' });
  assert.deepEqual(writes[1].body, { all_items_suitable_for_resale: true, reason: 'All sealed goods checked' });
});

test('refund review never sends a successful-refund claim and strike correction preserves an audit reason', async function (t) {
  const writes = recordWrites(t);
  await requestOrderRefundReview(3, 'Review required'); await correctCopStrike(4, 'Documented closure');
  assert.deepEqual(writes, [{ path: '/supervisor/orders/3/refund-review', method: 'PUT', body: { reason: 'Review required' } },
    { path: '/admin/cop-strikes/4/correction', method: 'PUT', body: { reason: 'Documented closure' } }]);
});

test('receipts and transaction records use explicit role endpoints and do not cache receipt responses', async function (t) {
  const urls = [];
  const signal = new AbortController().signal;
  t.mock.method(globalThis, 'fetch', async function (url, options) {
    urls.push(url); assert.equal(options.credentials, 'include'); assert.equal(options.signal, signal);
    if (url.endsWith('/receipt')) assert.equal(options.cache, 'no-store');
    return json({});
  });
  for (const role of ['shopper', 'supervisor', 'admin']) await getOrderReceipt(3, role, { signal });
  await getTransactionRecords('admin', { signal }); await getTransactionRecords('supervisor', { signal });
  assert.deepEqual(urls.map(function (url) { return url.replace('http://localhost:8000/api', ''); }), ['/shopper/orders/3/receipt', '/supervisor/orders/3/receipt', '/admin/orders/3/receipt', '/admin/transactions', '/supervisor/transactions']);
});

test('COP eligibility and notifications remain authenticated reads, and read acknowledgment uses CSRF', async function (t) {
  const urls = [];
  t.mock.method(globalThis, 'fetch', async function (url, options) { urls.push(url); assert.equal(options.credentials, 'include'); return json({}); });
  await getCopStatus(); await getOrderNotifications(); await getCopStrikes();
  assert.equal(urls.length, 3);
  const writes = recordWrites(t);
  await readOrderNotification(4);
  assert.deepEqual(writes, [{ path: '/shopper/order-notifications/4/read', method: 'PUT', body: {} }]);
});

test('CSRF failures and Busy-worker conflicts cannot turn into successful workflow writes', async function (t) {
  let blocked = true;
  let mutations = 0;
  t.mock.method(globalThis, 'fetch', async function (url) {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: blocked ? 503 : 204 });
    mutations++; return json({ message: 'Worker is Busy.' }, 409);
  });
  await assert.rejects(assignOrderWorker(3, 7, null), /secure session/);
  await assert.rejects(saveStorePickupSettings(2, {}, null), /secure session/);
  assert.equal(mutations, 0);
  blocked = false;
  await assert.rejects(assignOrderWorker(3, 7, null), function (error) { return error.status === 409; });
  assert.equal(mutations, 1);
});
