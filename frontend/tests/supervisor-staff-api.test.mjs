import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { assignSupervisorStaff, getSupervisorStaff } from '../src/services/api.js';

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

test('Supervisor staff reads use the session and cancellation without client-selected store filters', async (t) => {
  const controller = new AbortController();
  const data = { store: { store_id: 1 }, staff: [{ id: 3, assignment: { store_id: 1 } }], available_staff: [{ id: 12, approved: true, assignment: null }] };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://localhost:8000/api/supervisor/staff');
    assert.equal(options.credentials, 'include');
    assert.equal(options.headers.Accept, 'application/json');
    assert.equal(options.signal, controller.signal);
    return json(data);
  });
  assert.deepEqual(await getSupervisorStaff({ signal: controller.signal, store_id: 99, user_id: 99 }), data);
});

test('assignment sends an empty JSON body and derives the store and assigning Supervisor on the server', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(url);
    assert.equal(options.credentials, 'include');
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.equal(options.method, 'PUT');
    assert.equal(options.headers['X-XSRF-TOKEN'], 'secure=token');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), {});
    return json({ message: 'Inventory Worker assigned to your store.', assignment: { id: 7, user_id: 12, store_id: 1, assigned_by_user_id: 2, store: { store_id: 1, store_name: 'Store A' } } });
  });
  const result = await assignSupervisorStaff(12, { store_id: 99, user_id: 99, assigned_by_user_id: 99, role_id: 4 });
  assert.equal(result.assignment.store_id, 1);
  assert.equal(result.assignment.assigned_by_user_id, 2);
  assert.deepEqual(calls, ['http://localhost:8000/sanctum/csrf-cookie', 'http://localhost:8000/api/supervisor/staff/12/store-assignment']);
});

test('a staff account claimed by another store remains a 409 conflict', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => url.endsWith('/sanctum/csrf-cookie')
    ? new Response(null, { status: 204 }) : json({ message: 'This staff account is already assigned. Only Admin can transfer staff.' }, 409));
  await assert.rejects(assignSupervisorStaff(12), (error) => {
    assert.equal(error.status, 409);
    assert.match(error.message, /Only Admin can transfer staff/);
    return true;
  });
});

test('ineligible-account validation retains the user field message', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => url.endsWith('/sanctum/csrf-cookie')
    ? new Response(null, { status: 204 }) : json({ message: 'Validation failed.', errors: { user: ['Select an approved, available Inventory Worker.'] } }, 422));
  await assert.rejects(assignSupervisorStaff(12), (error) => error.status === 422 && error.errors.user[0] === 'Select an approved, available Inventory Worker.');
});

test('guest and unauthorized or inactive-store requests retain 401 and 403', async (t) => {
  let status = 401;
  t.mock.method(globalThis, 'fetch', async (url) => url.endsWith('/sanctum/csrf-cookie')
    ? new Response(null, { status: 204 }) : json({ message: 'Access denied.' }, status));
  await assert.rejects(getSupervisorStaff(), (error) => error.status === 401);
  await assert.rejects(assignSupervisorStaff(12), (error) => error.status === 401);
  status = 403;
  await assert.rejects(getSupervisorStaff(), (error) => error.status === 403);
  await assert.rejects(assignSupervisorStaff(12), (error) => error.status === 403);
});

test('CSRF initialization failure prevents any assignment write', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url) => {
    assert.ok(url.endsWith('/sanctum/csrf-cookie'));
    return new Response(null, { status: 503 });
  });
  await assert.rejects(assignSupervisorStaff(12), /Could not start a secure session/);
  assert.equal(fetch.mock.callCount(), 1);
});

test('a missing CSRF cookie prevents any assignment write', async (t) => {
  globalThis.document.cookie = '';
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  await assert.rejects(assignSupervisorStaff(12), /security cookie was not found/);
  assert.equal(fetch.mock.callCount(), 1);
});

test('expired security sessions, unknown accounts and rate limits remain failures', async (t) => {
  let status = 419;
  t.mock.method(globalThis, 'fetch', async (url) => url.endsWith('/sanctum/csrf-cookie')
    ? new Response(null, { status: 204 }) : json({ message: 'Request rejected.' }, status));
  await assert.rejects(assignSupervisorStaff(12), (error) => error.status === 419);
  status = 404;
  await assert.rejects(assignSupervisorStaff(12), (error) => error.status === 404);
  status = 429;
  await assert.rejects(assignSupervisorStaff(12), (error) => error.status === 429);
});

test('uncertain network failures are not automatically retried', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url) => {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    throw new TypeError('Network response lost');
  });
  await assert.rejects(assignSupervisorStaff(12), /Network response lost/);
  assert.equal(fetch.mock.callCount(), 2);
});
