import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { createAdminStore, getAdminStores, updateAdminStore, updateAdminStoreStatus } from '../src/services/api.js';

let previousDocument;
beforeEach(() => {
  previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true, value: { cookie: 'XSRF-TOKEN=secure%3Dtoken' },
  });
});
afterEach(() => {
  if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
  else delete globalThis.document;
});

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

test('store listing uses the authenticated session and forwards cancellation', async (t) => {
  const controller = new AbortController();
  const data = { stores: [{ store_id: 1, store_name: 'A', status: 'inactive', assigned_staff_count: 2 }] };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://localhost:8000/api/admin/stores');
    assert.equal(options.credentials, 'include');
    assert.equal(options.headers.Accept, 'application/json');
    assert.equal(options.signal, controller.signal);
    return json(data);
  });
  assert.deepEqual(await getAdminStores({ signal: controller.signal }), data);
});

test('creating a store sends only name and address with CSRF protection', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(url);
    assert.equal(options.credentials, 'include');
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['X-XSRF-TOKEN'], 'secure=token');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), { store_name: 'New branch', address: 'Cebu City' });
    return json({ store: { store_id: 3, status: 'active' } }, 201);
  });
  assert.equal((await createAdminStore({ store_name: 'New branch', address: 'Cebu City', store_id: 999, status: 'inactive', owner_id: 7, user_id: 99, assigned_staff_count: 9 })).store.status, 'active');
  assert.deepEqual(calls, ['http://localhost:8000/sanctum/csrf-cookie', 'http://localhost:8000/api/admin/stores']);
});

test('metadata updates cannot send a replacement store ID, owner or status', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.equal(url, 'http://localhost:8000/api/admin/stores/12');
    assert.equal(options.method, 'PUT');
    assert.equal(options.headers['X-XSRF-TOKEN'], 'secure=token');
    assert.deepEqual(JSON.parse(options.body), { store_name: 'Edited branch', address: 'New address' });
    return json({ store: { store_id: 12, status: 'inactive' } });
  });
  assert.equal((await updateAdminStore(12, { store_name: 'Edited branch', address: 'New address', status: 'active', store_id: 99, owner_id: 7 })).store.status, 'inactive');
});

test('deactivation and reactivation use the explicit status endpoint and value', async (t) => {
  const statuses = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.equal(url, 'http://localhost:8000/api/admin/stores/12/status');
    assert.equal(options.method, 'PUT');
    assert.equal(options.credentials, 'include');
    assert.equal(options.headers['X-XSRF-TOKEN'], 'secure=token');
    assert.equal(Object.keys(JSON.parse(options.body)).length, 1);
    statuses.push(JSON.parse(options.body).status);
    return json({ store: { store_id: 12, status: statuses.at(-1) } });
  });
  assert.equal((await updateAdminStoreStatus(12, 'inactive')).store.status, 'inactive');
  assert.equal((await updateAdminStoreStatus(12, 'active')).store.status, 'active');
  assert.deepEqual(statuses, ['inactive', 'active']);
});

test('field validation responses retain status and messages for the store form', async (t) => {
  const errors = { store_name: ['The store name field is required.'], address: ['The address field is required.'] };
  t.mock.method(globalThis, 'fetch', async (url) => url.endsWith('/sanctum/csrf-cookie')
    ? new Response(null, { status: 204 }) : json({ message: 'Invalid store details.', errors }, 422));
  await assert.rejects(createAdminStore({}), (error) => {
    assert.equal(error.status, 422);
    assert.deepEqual(error.errors, errors);
    return true;
  });
});

test('CSRF initialization failure prevents all store mutations', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url) => {
    assert.ok(url.endsWith('/sanctum/csrf-cookie'));
    return new Response(null, { status: 503 });
  });
  await assert.rejects(createAdminStore({}), /Could not start a secure session/);
  await assert.rejects(updateAdminStore(12, {}), /Could not start a secure session/);
  await assert.rejects(updateAdminStoreStatus(12, 'inactive'), /Could not start a secure session/);
  assert.equal(fetch.mock.callCount(), 3);
});

test('guests and non-Admin roles cannot turn failed store requests into empty lists', async (t) => {
  let status = 401;
  t.mock.method(globalThis, 'fetch', async () => json({ message: 'Access denied.' }, status));
  await assert.rejects(getAdminStores(), (error) => error.status === 401);
  status = 403;
  await assert.rejects(getAdminStores(), (error) => error.status === 403);
});

test('expired sessions, unknown stores and throttling remain failed writes', async (t) => {
  let status = 419;
  t.mock.method(globalThis, 'fetch', async (url) => url.endsWith('/sanctum/csrf-cookie')
    ? new Response(null, { status: 204 }) : json({ message: 'Request rejected.' }, status));
  await assert.rejects(createAdminStore({}), (error) => error.status === 419);
  status = 404;
  await assert.rejects(updateAdminStore(12, {}), (error) => error.status === 404);
  status = 429;
  await assert.rejects(updateAdminStoreStatus(12, 'inactive'), (error) => error.status === 429);
});
