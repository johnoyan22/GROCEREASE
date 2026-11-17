import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createCategory, updateCategory, deleteCategory, getCategories, getCategoryOptions, getAutomaticLowStock, getLowStockNotifications } from '../src/services/api.js';

afterEach(() => { delete globalThis.document; });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
test('category and monitoring reads preserve credentials, cancellation, pagination and uncached reads', async (t) => {
  const signal = new AbortController().signal, calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.credentials, 'include'); assert.equal(options.signal, signal); assert.equal(options.cache, 'no-store');
    calls.push(new URL(url)); return json({});
  });
  await getCategories({ signal, page: 2, status: 'inactive', search: 'Fresh produce' });
  await getCategoryOptions({ signal });
  await getAutomaticLowStock({ signal, page: 1, store: 3, product: 8 });
  await getLowStockNotifications({ signal, page: 2, unread: false });
  await getLowStockNotifications({ signal, page: 1, unread: true });
  assert.equal(calls[0].searchParams.get('search'), 'Fresh produce');
  assert.equal(calls[0].searchParams.get('status'), 'inactive');
  assert.equal(calls[1].pathname, '/api/staff/category-options');
  assert.equal(calls[2].searchParams.get('product'), '8');
  assert.equal(calls[3].searchParams.get('unread'), '0');
  assert.equal(calls[4].searchParams.get('unread'), '1');
});

test('category CRUD sends only editable fields with CSRF, including explicit deletion', async (t) => {
  globalThis.document = { cookie: 'XSRF-TOKEN=secure' };
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.equal(options.credentials, 'include'); assert.equal(options.headers['X-XSRF-TOKEN'], 'secure');
    calls.push({ url, method: options.method, body: JSON.parse(options.body) }); return json({ message: 'Saved' });
  });
  await createCategory({ name: 'Produce', status: 'active', store_id: 99, name_key: 'forged', created_by_user_id: 1 });
  await updateCategory(7, { name: 'Fresh Produce', status: 'inactive', category_id: 99, ever_used_at: null });
  await deleteCategory(7);
  assert.deepEqual(calls.map((r) => r.method), ['POST', 'PUT', 'DELETE']);
  assert.deepEqual(calls.map((r) => r.body), [{ name: 'Produce', status: 'active' }, { name: 'Fresh Produce', status: 'inactive' }, {}]);
  assert.ok(calls[2].url.endsWith('/supervisor/categories/7'));
});

test('failed security setup prevents category writes and foreign/stale option errors stay actionable', async (t) => {
  globalThis.document = { cookie: '' };
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  for (const save of [() => createCategory({ name: 'A', status: 'active' }), () => updateCategory(1, {}), () => deleteCategory(1)]) await assert.rejects(save, /security cookie/);
});
