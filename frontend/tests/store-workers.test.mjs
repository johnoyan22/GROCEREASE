import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { createStoreWorker, getStoreWorkers, updateStoreWorker } from '../src/services/api.js';

let previousDocument;
beforeEach(function () {
  previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'XSRF-TOKEN=secure%3Dtoken' } });
});
afterEach(function () {
  if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
  else delete globalThis.document;
});
function json(data, status = 200) { return new Response(JSON.stringify(data), { status }); }

test('personnel reads use the Supervisor session and abort signal', async function (t) {
  const signal = new AbortController().signal;
  t.mock.method(globalThis, 'fetch', async function (url, options) {
    assert.equal(url, 'http://localhost:8000/api/supervisor/workers');
    assert.equal(options.credentials, 'include'); assert.equal(options.signal, signal);
    return json({ workers: [], store: { store_id: 1 } });
  });
  assert.deepEqual((await getStoreWorkers({ signal })).workers, []);
});

test('personnel creation sends no login credentials, roles, store, or incentive amounts', async function (t) {
  t.mock.method(globalThis, 'fetch', async function (url, options) {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.equal(options.method, 'POST'); assert.equal(options.headers['X-XSRF-TOKEN'], 'secure=token');
    assert.deepEqual(JSON.parse(options.body), { full_name: 'Picker One', work_type: 'picker_packer' });
    return json({ worker: { worker_id: 1 } }, 201);
  });
  await createStoreWorker({ full_name: 'Picker One', work_type: 'picker_packer', store_id: 999, email: 'fake@example.test', password: 'fake', role: 'admin', worker_incentives: 99 });
});

test('personnel updates only send editable personnel fields', async function (t) {
  t.mock.method(globalThis, 'fetch', async function (url, options) {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.equal(url, 'http://localhost:8000/api/supervisor/workers/4'); assert.equal(options.method, 'PUT');
    assert.deepEqual(JSON.parse(options.body), { full_name: 'Picker One', work_type: 'picker', status: 'inactive' });
    return json({ message: 'Saved' });
  });
  await updateStoreWorker(4, { full_name: 'Picker One', work_type: 'picker', status: 'inactive', user_id: 999, store_id: 999 });
});

test('foreign-store, invalid, and busy-worker responses remain actionable failures', async function (t) {
  let status = 404;
  t.mock.method(globalThis, 'fetch', async function (url) {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    return json({ message: 'Worker update denied.' }, status);
  });
  for (status of [403, 404, 409, 422]) await assert.rejects(updateStoreWorker(4, {}), function (error) { return error.status === status; });
});

test('failed CSRF initialization prevents worker writes', async function (t) {
  const fetch = t.mock.method(globalThis, 'fetch', async function (url) {
    assert.ok(url.endsWith('/sanctum/csrf-cookie')); return new Response(null, { status: 503 });
  });
  await assert.rejects(createStoreWorker({}), /secure session/);
  await assert.rejects(updateStoreWorker(4, {}), /secure session/);
  assert.equal(fetch.mock.callCount(), 2);
});

test('missing database setup and expired sessions do not appear as an empty personnel roster', async function (t) {
  let status = 503;
  t.mock.method(globalThis, 'fetch', async function () { return json({ message: 'Unavailable' }, status); });
  for (status of [401, 503]) await assert.rejects(getStoreWorkers(), function (error) { return error.status === status; });
});
