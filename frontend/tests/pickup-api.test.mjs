import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { confirmOrderCash, getOrderPickup, recordOrderHandover, verifyOrderPickup } from '../src/services/api.js';

let previousDocument;
beforeEach(function () {
  previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'XSRF-TOKEN=pickup%3Dtoken' } });
});
afterEach(function () {
  if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
  else delete globalThis.document;
});
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }); }

test('pickup secrets use an authenticated uncached read and are not put in the URL', async function (t) {
  const signal = new AbortController().signal;
  t.mock.method(globalThis, 'fetch', async function (url, options) {
    assert.equal(url, 'http://localhost:8000/api/shopper/orders/5/pickup');
    assert.equal(options.credentials, 'include'); assert.equal(options.cache, 'no-store'); assert.equal(options.signal, signal);
    return json({ credential: { pin: '12345678' } });
  });
  assert.equal((await getOrderPickup(5, { signal })).credential.pin, '12345678');
});

test('cash confirmation sends evidence without trusting client totals, paid state, or store/actor identity', async function (t) {
  t.mock.method(globalThis, 'fetch', async function (url, options) {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.ok(url.endsWith('/supervisor/orders/5/cash-payment')); assert.equal(options.method, 'PUT');
    assert.equal(options.headers['X-XSRF-TOKEN'], 'pickup=token');
    assert.deepEqual(JSON.parse(options.body), { cashier_name: 'Cashier', evidence_reference: '001', cash_collected: true });
    return json({ message: 'Confirmed' });
  });
  await confirmOrderCash(5, { cashier_name: 'Cashier', evidence_reference: '001', cash_collected: true, payment_status: 'paid', amount_centavos: 1, store_id: 2, confirmed_by_user_id: 999 });
});

test('claimant verification records the in-person check without advance representative registration or images', async function (t) {
  t.mock.method(globalThis, 'fetch', async function (url, options) {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.ok(url.endsWith('/supervisor/orders/5/pickup-verification')); assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'include'); assert.equal(options.headers['X-XSRF-TOKEN'], 'pickup=token');
    assert.deepEqual(JSON.parse(options.body), { method: 'pin', credential: '12345678', claimant_name: 'Actual Claimant', identity_checked: true, claimant_check_note: 'Checked in person' });
    return json({ message: 'Verified' });
  });
  await verifyOrderPickup(5, { method: 'pin', credential: '12345678', claimant_name: 'Actual Claimant', identity_checked: true, claimant_check_note: 'Checked in person', store_id: 2, verified_by_user_id: 999, government_id_image: 'forbidden', collector_id: 999 });
});

test('physical handover is its own CSRF-protected write without a frontend paid flag', async function (t) {
  t.mock.method(globalThis, 'fetch', async function (url, options) {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.ok(url.endsWith('/handover')); assert.equal(options.method, 'PUT');
    assert.equal(options.headers['X-XSRF-TOKEN'], 'pickup=token');
    assert.deepEqual(JSON.parse(options.body), { physically_handed_over: true });
    return json({ message: 'Saved' });
  });
  await recordOrderHandover(5);
});

test('rate limits and unknown outcomes are surfaced without automatically retrying verification or handover', async function (t) {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async function (url) {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    calls++;
    if (calls === 1) return json({ message: 'Too many attempts.' }, 429);
    throw new TypeError('Connection lost');
  });
  await assert.rejects(verifyOrderPickup(5, {}), function (error) { return error.status === 429; });
  await assert.rejects(recordOrderHandover(5), /Connection lost/);
  assert.equal(calls, 2);
});
