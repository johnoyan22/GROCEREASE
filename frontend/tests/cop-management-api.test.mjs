import assert from 'node:assert/strict';
import { test } from 'node:test';
import { correctCopStrike, getCopAccount, getCopAccounts, getCopFailedClaim, getCopFailedClaims, getCopPolicy, restoreCopAccess, restrictCopAccess, saveCopPolicy } from '../src/services/api.js';
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('COP tables use authenticated bounded query parameters and private reads', async t => {
  const calls = [], controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (url, options) => { calls.push({ url: new URL(url, 'http://localhost'), options }); return json({}); });
  await getCopPolicy(2, { signal: controller.signal });
  await getCopFailedClaims({ page: 3, from: '2026-11-01', until: '2026-11-17', search: 'GE-ORD-00000001', store_id: '', classification: 'paid_unclaimed' });
  await getCopAccounts({ search: 'No Strike', eligibility: 'manual', page: 1 });
  await getCopAccount(5, 2); await getCopFailedClaim(9, 1);
  assert.equal(calls[0].options.signal, controller.signal);
  for (const { options } of calls) { assert.equal(options.credentials, 'include'); assert.equal(options.cache, 'no-store'); }
  assert.equal(calls[1].url.searchParams.get('page'), '3'); assert.equal(calls[1].url.searchParams.has('store_id'), false);
  assert.equal(calls[1].url.searchParams.get('classification'), 'paid_unclaimed');
  assert.equal(calls[2].url.searchParams.get('eligibility'), 'manual'); assert.match(calls[3].url.pathname, /accounts\/5$/);
});

test('COP decisions send explicit confirmation and optimistic version with CSRF; conflicts remain errors', async t => {
  const writes = [];
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'XSRF-TOKEN=test' } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'document', previous); else delete globalThis.document; });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/csrf-cookie')) return json({});
    assert.equal(options.headers['X-XSRF-TOKEN'], 'test'); writes.push({ url, body: JSON.parse(options.body) });
    return json({ message: 'Version changed' }, 409);
  });
  const decision = { expected_version: 3, confirmed: true, reason: 'Documented review' };
  for (const action of [() => saveCopPolicy({ ...decision, enabled: true, maximum_php: '1500.01', temporary_threshold: 2, temporary_days: 30, permanent_threshold: 3 }), () => restrictCopAccess(5, { ...decision, kind: 'temporary', until: '2099-01-01T17:30' }), () => restoreCopAccess(5, decision), () => correctCopStrike(9, decision)]) await assert.rejects(action, error => error.status === 409);
  assert.equal(writes[0].body.maximum_php, '1500.01');
  assert.equal(writes[1].body.until, '2099-01-01T17:30');
  for (const { body } of writes) { assert.equal(body.expected_version, 3); assert.equal(body.confirmed, true); assert.equal(body.actor_user_id, undefined); }
});
