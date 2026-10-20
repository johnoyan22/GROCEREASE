import assert from 'node:assert/strict';
import { beforeEach, afterEach, test } from 'node:test';
import { getDashboardSummary, getPaymentOptions, getPaymentSession, startPaymentSession, getCheckoutQuote, getAdminAccounts, updateAccountStatus } from '../src/services/api.js';
import { databaseDate, philippineDay } from '../src/services/dates.js';

let previous;
beforeEach(() => { previous = Object.getOwnPropertyDescriptor(globalThis, 'document'); Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'XSRF-TOKEN=test' } }); });
afterEach(() => { if (previous) Object.defineProperty(globalThis, 'document', previous); else delete globalThis.document; });
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });

test('dashboard, account and sandbox reads preserve authenticated uncached access without actor/store overrides', async t => {
  const paths = []; const signal = new AbortController().signal;
  t.mock.method(globalThis, 'fetch', async (url, options) => { paths.push(url.replace('http://localhost:8000/api', '')); assert.equal(options.credentials, 'include'); assert.equal(options.signal, signal); assert.equal(options.cache, 'no-store'); return json({}); });
  await getDashboardSummary({ signal }); await getPaymentOptions(2, { signal }); await getPaymentSession(9, { signal }); await getAdminAccounts({ signal });
  assert.deepEqual(paths, ['/dashboard/summary', '/shopper/stores/2/payment-options', '/shopper/orders/9/payment-session', '/admin/accounts']);
});

test('payment session creation sends no payment claim, amount, reference or merchant identity', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.equal(options.method, 'POST'); assert.deepEqual(JSON.parse(options.body), {});
    assert.equal(options.headers['X-XSRF-TOKEN'], 'test'); return json({ payment: { status: 'pending_payment' } });
  });
  assert.equal((await startPaymentSession(9)).payment.status, 'pending_payment');
});

test('digital quote carries only the selected payment channel with the cart and schedule', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    const body = JSON.parse(options.body); assert.equal(body.payment_method, 'digital'); assert.equal(body.payment_channel, 'card');
    assert.equal(body.total_centavos, undefined); assert.equal(body.payment_status, undefined); assert.equal(body.provider_reference, undefined);
    return json({});
  });
  await getCheckoutQuote({ store_id: 1, items: [{ store_inventory_id: 7, quantity: 2 }], payment_method: 'digital', payment_channel: 'card', payment_status: 'paid', total_centavos: 1, provider_reference: 'fake' });
});

test('account status action sends explicit status and reason with CSRF', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.ok(url.endsWith('/admin/accounts/5/status')); assert.equal(options.method, 'PUT');
    assert.deepEqual(JSON.parse(options.body), { account_status: 'inactive', reason: 'Review' }); return json({});
  });
  await updateAccountStatus(5, 'inactive', 'Review');
});

test('Manila report dates treat database timestamps as UTC and honor explicit offsets', () => {
  assert.equal(philippineDay('2026-10-20 16:01:00'), '2026-10-21');
  assert.equal(philippineDay('2026-10-20T23:59:00+08:00'), '2026-10-20');
  assert.equal(databaseDate('2026-10-20 16:01:00').toISOString(), '2026-10-20T16:01:00.000Z');
});
