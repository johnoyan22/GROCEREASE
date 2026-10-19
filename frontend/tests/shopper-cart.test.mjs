import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cartSummary, changeCartQuantity, maximumQuantity, readSavedCart } from '../src/services/cart.js';
import { getShopperProducts, getShopperStores } from '../src/services/api.js';

const rice = { store_inventory_id: 7, store_id: 1, product_name: 'Rice', selling_price: '67.25', available_stock: 85, max_per_order: 4 };
const cart = { store_id: 1, items: [] };

test('cart adds, changes quantities, and removes a product without storing prices', function () {
  let result = changeCartQuantity(cart, 1, rice, 2);
  assert.deepEqual(result.items, [{ store_inventory_id: 7, quantity: 2 }]);
  result = changeCartQuantity(result, 1, rice, 3);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].quantity, 3);
  result = changeCartQuantity(result, 1, rice, 0);
  assert.deepEqual(result.items, []);
});

test('cart rejects mixed stores, fractional quantities, limits, and unavailable stock', function () {
  assert.throws(function () { changeCartQuantity(cart, 2, rice, 1); }, /one store/);
  assert.throws(function () { changeCartQuantity(cart, 1, { ...rice, store_id: 2 }, 1); }, /one store/);
  for (const quantity of [-1, 1.5, NaN]) assert.throws(function () { changeCartQuantity(cart, 1, rice, quantity); }, /whole quantity/);
  assert.throws(function () { changeCartQuantity(cart, 1, rice, 5); }, /limit/);
  assert.throws(function () { changeCartQuantity(cart, 1, { ...rice, available_stock: 0 }, 1); }, /stock/);
  assert.equal(maximumQuantity({ ...rice, max_per_order: null }), 85);
});

test('cart totals use current catalog prices and exact centavos', function () {
  const result = cartSummary({ store_id: 1, items: [{ store_inventory_id: 7, quantity: 3 }] }, [rice]);
  assert.equal(result.subtotalCentavos, 20175);
  assert.equal(result.valid, true);
  const repriced = cartSummary({ store_id: 1, items: [{ store_inventory_id: 7, quantity: 3 }] }, [{ ...rice, selling_price: '67.35' }]);
  assert.equal(repriced.subtotalCentavos, 20205);
});

test('refreshing stock, limits, and availability invalidates a saved cart that needs review', function () {
  const draft = { store_id: 1, items: [{ store_inventory_id: 7, quantity: 3 }] };
  assert.equal(cartSummary(draft, [{ ...rice, available_stock: 2 }]).valid, false);
  assert.equal(cartSummary(draft, [{ ...rice, max_per_order: 2 }]).valid, false);
  assert.equal(cartSummary(draft, []).valid, false);
  assert.equal(cartSummary(cart, [rice]).valid, false);
});

test('unsafe integer totals cannot be used for checkout', function () {
  const result = cartSummary({ store_id: 1, items: [{ store_inventory_id: 7, quantity: 2147483647 }] }, [
    { ...rice, selling_price: '99999999.99', available_stock: 2147483647, max_per_order: null },
  ]);
  assert.equal(result.valid, false);
  assert.match(result.rows[0].error, /too large/);
});

test('saved carts are scoped by account and strip untrusted prices and other fields', function () {
  const result = readSavedCart({ getItem: function (key) {
    assert.equal(key, 'grocerease-cart-5');
    return JSON.stringify({ store_id: 1, items: [{ store_inventory_id: 7, quantity: 2, price: 0, status: 'paid' }] });
  } }, 5);
  assert.deepEqual(result, { store_id: 1, items: [{ store_inventory_id: 7, quantity: 2 }] });
});

test('corrupt storage, duplicate item IDs, and invalid quantities restore an empty cart', function () {
  for (const raw of ['broken', 'null', JSON.stringify({ store_id: 1, items: [{ store_inventory_id: 7, quantity: -1 }] }),
    JSON.stringify({ store_id: 1, items: [{ store_inventory_id: 7, quantity: 1 }, { store_inventory_id: 7, quantity: 2 }] })]) {
    assert.deepEqual(readSavedCart({ getItem: function () { return raw; } }, 5), { store_id: null, items: [] });
  }
});

test('shopper catalog requests preserve credentials and explicit selected-store paths', async function (t) {
  const signal = new AbortController().signal;
  const paths = [];
  t.mock.method(globalThis, 'fetch', async function (url, options) {
    paths.push(url);
    assert.equal(options.credentials, 'include');
    assert.equal(options.signal, signal);
    return new Response(JSON.stringify({ stores: [], products: [] }), { status: 200 });
  });
  await getShopperStores({ signal });
  await getShopperProducts(2, { signal });
  assert.deepEqual(paths, ['http://localhost:8000/api/shopper/stores', 'http://localhost:8000/api/shopper/stores/2/products']);
});
