import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  createStoreProduct,
  getAssignedStore,
  getInventoryItems,
  updateStoreProduct,
} from '../src/services/api.js';

let previousDocument;
beforeEach(() => {
  previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { cookie: 'XSRF-TOKEN=secure%3Dtoken' },
  });
});
afterEach(() => {
  if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
  else delete globalThis.document;
});

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

test('inventory reads include the authenticated session and cancellation signal', async (t) => {
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://localhost:8000/api/inventory/items');
    assert.equal(options.credentials, 'include');
    assert.equal(options.signal, controller.signal);
    assert.equal(options.headers.Accept, 'application/json');
    return json({ store: { store_id: 1 }, inventory: [] });
  });
  assert.deepEqual(await getInventoryItems({ signal: controller.signal }), {
    store: { store_id: 1 }, inventory: [],
  });
});

test('assigned store uses the existing staff endpoint', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url, 'http://localhost:8000/api/staff/store');
    return json({ store: { store_id: 2 } });
  });
  assert.equal((await getAssignedStore()).store.store_id, 2);
});

test('creating a store product sends metadata with CSRF and excludes ownership overrides', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(url);
    assert.equal(options.credentials, 'include');
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['X-XSRF-TOKEN'], 'secure=token');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), {
      product_name: 'Store Rice', sku: 'RICE-001', barcode: '000123', size: '1 kg',
      category: 'Staples', selling_price: '25.50', status: 'inactive',
    });
    return json({ message: 'Product added to your store.' }, 201);
  });
  await createStoreProduct({
    product_name: 'Store Rice', sku: 'RICE-001', barcode: '000123', size: '1 kg',
    category: 'Staples', selling_price: '25.50', status: 'inactive',
    store_id: 999, product_id: 999, hard_stock_qty: 99, soft_stock_qty: 88,
  });
  assert.deepEqual(calls, [
    'http://localhost:8000/sanctum/csrf-cookie',
    'http://localhost:8000/api/inventory/items',
  ]);
});

test('updates preserve decimal text and exclude product/store/quantity changes', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.equal(url, 'http://localhost:8000/api/inventory/items/7');
    assert.equal(options.method, 'PUT');
    assert.equal(options.headers['X-XSRF-TOKEN'], 'secure=token');
    assert.deepEqual(JSON.parse(options.body), { product_name: 'Updated Rice', sku: 'RICE-001', selling_price: '72.25', status: 'active' });
    return json({ message: 'Store price and status saved.' });
  });
  await updateStoreProduct(7, {
    product_name: 'Updated Rice', sku: 'RICE-001', selling_price: '72.25', status: 'active', product_id: 4, store_id: 99, hard_stock_qty: 100,
  });
});

test('CSRF initialization failure prevents mutation requests', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url) => {
    assert.ok(url.endsWith('/sanctum/csrf-cookie'));
    return new Response(null, { status: 503 });
  });
  await assert.rejects(createStoreProduct({}), /Could not start a secure session/);
  assert.equal(fetch.mock.callCount(), 1);
});

test('validation errors retain status and field messages for the form', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    return json({
      message: 'The selling price field must be at least 0.',
      errors: { selling_price: ['The selling price field must be at least 0.'] },
    }, 422);
  });
  await assert.rejects(updateStoreProduct(7, { selling_price: '-1', status: 'active' }), (error) => {
    assert.equal(error.status, 422);
    assert.match(error.errors.selling_price[0], /at least 0/);
    return true;
  });
});

test('unauthenticated inventory requests remain failures', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => json({ message: 'Unauthenticated.' }, 401));
  await assert.rejects(getInventoryItems(), (error) => error.status === 401);
});

test('store-local SKU validation errors reach the product form', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    return json({
      message: 'The sku has already been taken.',
      errors: { sku: ['This SKU already exists in your store.'] },
    }, 422);
  });
  await assert.rejects(createStoreProduct({ sku: 'RICE-001' }), (error) => {
    assert.equal(error.status, 422);
    assert.match(error.errors.sku[0], /your store/);
    return true;
  });
});
