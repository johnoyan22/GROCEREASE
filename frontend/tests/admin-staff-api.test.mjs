import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { approveAdminStaff, assignAdminStaffStore, createAdminStaff, getAdminStaffAssignments } from '../src/services/api.js';

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

test('admin staff reads use the real assignment endpoint with session and cancellation', async (t) => {
  const controller = new AbortController();
  const data = { staff: [{ id: 2, approved: false, assignment: null }], stores: [{ store_id: 1 }] };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://localhost:8000/api/admin/staff-store-assignments');
    assert.equal(options.credentials, 'include');
    assert.equal(options.headers.Accept, 'application/json');
    assert.equal(options.signal, controller.signal);
    return json(data);
  });
  assert.deepEqual(await getAdminStaffAssignments({ signal: controller.signal }), data);
});

test('staff creation sends only onboarding fields with CSRF and session cookies', async (t) => {
  const details = {
    first_name: 'New', last_name: 'Staff', email: 'staff@example.test',
    phone_number: '09900000001', address: null, role: 'supervisor',
    password: 'ExamplePass123!', password_confirmation: 'ExamplePass123!',
  };
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(url);
    assert.equal(options.credentials, 'include');
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['X-XSRF-TOKEN'], 'secure=token');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), details);
    return json({ message: 'Staff account created and approved.', staff: { id: 2, approved: true } }, 201);
  });
  const result = await createAdminStaff({ ...details, store_id: 99, user_id: 50, role_id: 4, staff_approved_at: 'spoof', staff_approved_by_user_id: 99, email_verified_at: 'spoof' });
  assert.equal(result.staff.approved, true);
  assert.deepEqual(calls, ['http://localhost:8000/sanctum/csrf-cookie', 'http://localhost:8000/api/admin/staff']);
});

test('approval sends no client-selected approver or approval timestamp', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.equal(url, 'http://localhost:8000/api/admin/staff/12/approval');
    assert.equal(options.method, 'PUT');
    assert.equal(options.credentials, 'include');
    assert.equal(options.headers['X-XSRF-TOKEN'], 'secure=token');
    assert.deepEqual(JSON.parse(options.body), {});
    return json({ staff: { id: 12, approved: true, approved_by_user_id: 1 } });
  });
  assert.equal((await approveAdminStaff(12)).staff.approved_by_user_id, 1);
});

test('assignment and transfer send only the selected store to the staff-specific endpoint', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.equal(url, 'http://localhost:8000/api/admin/staff/12/store-assignment');
    assert.equal(options.method, 'PUT');
    assert.equal(options.headers['X-XSRF-TOKEN'], 'secure=token');
    assert.equal(options.credentials, 'include');
    assert.deepEqual(JSON.parse(options.body), { store_id: 2 });
    return json({ assignment: { user_id: 12, store_id: 2, assigned_by_user_id: 1 } });
  });
  assert.equal((await assignAdminStaffStore(12, 2)).assignment.store_id, 2);
});

test('creation retains duplicate-email, phone and password validation messages', async (t) => {
  const errors = { email: ['The email has already been taken.'], phone_number: ['The phone number has already been taken.'], password: ['The password confirmation does not match.'] };
  t.mock.method(globalThis, 'fetch', async (url) => url.endsWith('/sanctum/csrf-cookie')
    ? new Response(null, { status: 204 }) : json({ message: 'Validation failed.', errors }, 422));
  await assert.rejects(createAdminStaff({}), (error) => {
    assert.equal(error.status, 422);
    assert.deepEqual(error.errors, errors);
    return true;
  });
});

test('an inactive destination rejection remains a form error', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => url.endsWith('/sanctum/csrf-cookie')
    ? new Response(null, { status: 204 }) : json({ message: 'Select an active store.', errors: { store_id: ['Select an active store.'] } }, 422));
  await assert.rejects(assignAdminStaffStore(12, 2), (error) => error.status === 422 && error.errors.store_id[0] === 'Select an active store.');
});

test('CSRF initialization failure prevents staff writes', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url) => {
    assert.ok(url.endsWith('/sanctum/csrf-cookie'));
    return new Response(null, { status: 503 });
  });
  await assert.rejects(createAdminStaff({}), /Could not start a secure session/);
  await assert.rejects(approveAdminStaff(12), /Could not start a secure session/);
  await assert.rejects(assignAdminStaffStore(12, 2), /Could not start a secure session/);
  assert.equal(fetch.mock.callCount(), 3);
});

test('missing security cookie also prevents staff writes', async (t) => {
  globalThis.document.cookie = '';
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  await assert.rejects(createAdminStaff({}), /security cookie was not found/);
  assert.equal(fetch.mock.callCount(), 1);
});

test('guest and unauthorized staff reads keep 401 and 403 status codes', async (t) => {
  let status = 401;
  t.mock.method(globalThis, 'fetch', async () => json({ message: status === 401 ? 'Unauthenticated.' : 'Forbidden.' }, status));
  await assert.rejects(getAdminStaffAssignments(), (error) => error.status === 401);
  status = 403;
  await assert.rejects(getAdminStaffAssignments(), (error) => error.status === 403);
});

test('expired sessions, missing staff and throttling remain failed mutations', async (t) => {
  let status = 419;
  t.mock.method(globalThis, 'fetch', async (url) => url.endsWith('/sanctum/csrf-cookie')
    ? new Response(null, { status: 204 }) : json({ message: 'Request rejected.' }, status));
  await assert.rejects(createAdminStaff({}), (error) => error.status === 419);
  status = 404;
  await assert.rejects(approveAdminStaff(12), (error) => error.status === 404);
  status = 429;
  await assert.rejects(assignAdminStaffStore(12, 2), (error) => error.status === 429);
});
