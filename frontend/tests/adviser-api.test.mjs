import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { uploadProfilePhoto, uploadProductPhoto, saveStoreCategory, submitStockReceiving, submitStockImport, decideStockReceiving, acknowledgeStockAlert } from '../src/services/api.js';
let previous;
beforeEach(() => { previous = Object.getOwnPropertyDescriptor(globalThis, 'document'); Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'XSRF-TOKEN=secure' } }); });
afterEach(() => { if (previous) Object.defineProperty(globalThis, 'document', previous); else delete globalThis.document; });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
test('photo uploads preserve multipart boundary and session CSRF without accepting identity overrides', async t => {
  const bodies = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.credentials, 'include');
    if (url.endsWith('/csrf-cookie')) return new Response(null, { status: 204 });
    assert.equal(options.headers['X-XSRF-TOKEN'], 'secure');
    assert.equal(options.headers['Content-Type'], undefined);
    assert.ok(options.body instanceof FormData); bodies.push([...options.body.keys()]);
    return json({ message: 'Saved' });
  });
  const file = new File(['png'], 'photo.png', { type: 'image/png' });
  await uploadProfilePhoto(file); await uploadProductPhoto(4, file);
  assert.deepEqual(bodies, [['photo'], ['photo']]);
});
test('catalog and receiving writes send only editable metadata while leaving actors, stores and stock to the backend', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/csrf-cookie')) return new Response(null, { status: 204 });
    assert.equal(options.headers['X-XSRF-TOKEN'], 'secure'); calls.push({ url, data: JSON.parse(options.body) }); return json({ message: 'Submitted' });
  });
  await saveStoreCategory(3, { name: 'Drinks', active: false, store_id: 99, updated_by_user_id: 99 });
  await submitStockReceiving(4, { kind: 'receive', quantity: 5, received_date: '2026-11-10', expiration_date: null, batch_reference: 'D1', description: 'Delivery', hard_stock_qty: 999, store_id: 99 });
  await submitStockImport('signed-preview'); await decideStockReceiving(8, 'approved', 'Counted'); await acknowledgeStockAlert(6);
  assert.deepEqual(calls[0].data, { name: 'Drinks', active: false });
  assert.equal(calls[1].data.hard_stock_qty, undefined); assert.equal(calls[1].data.store_id, undefined);
  assert.deepEqual(calls[2].data, { preview_token: 'signed-preview' });
  assert.deepEqual(calls[3].data, { decision: 'approved', decision_note: 'Counted' });
  assert.deepEqual(calls[4].data, {});
});
test('CSRF failure prevents receiving imports, category changes and alert acknowledgements', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 503 }));
  for (const action of [() => submitStockImport('token'), () => saveStoreCategory(null, {}), () => acknowledgeStockAlert(1)]) await assert.rejects(action, /secure session/);
  assert.equal(mock.mock.callCount(), 3);
});
