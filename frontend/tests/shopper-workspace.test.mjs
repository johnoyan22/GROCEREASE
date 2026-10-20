import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:5173/shopper/dashboard' });
for (const name of ['window', 'document', 'sessionStorage', 'HTMLElement', 'HTMLInputElement', 'Event', 'MouseEvent']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
const { act, createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
let server, Dashboard, Checkout, AdminDashboard, TransactionRecords, root, userId, products, orders, unread, calls, failCatalog, channels;
const product = { store_id: 1, store_inventory_id: 7, product_name: 'Rice', category: 'Staples', sku: 'RICE', size: '1kg', barcode: null, selling_price: '67.25', available_stock: 20, max_per_order: 5 };
const schedule = { pickup_date: '2026-10-21', pickup_start: '10:00', pickup_end: '11:00' };
const key = '04a87418-5ada-4bee-9c35-3cb608cfa525';
const text = () => document.body.textContent;
function button(label) { return [...document.querySelectorAll('button')].find(el => el.textContent.trim() === label); }
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 15)); }); }
async function click(el) { assert.ok(el, 'Expected button'); await act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true }))); await settle(); }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }); }
async function mount() {
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(MemoryRouter, null, createElement(Dashboard))));
  await settle();
}
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
  Dashboard = (await server.ssrLoadModule('/src/pages/shopper/ShopperDashboard.jsx')).default;
  Checkout = (await server.ssrLoadModule('/src/components/Shoppers/ShopperCheckout.jsx')).default;
  AdminDashboard = (await server.ssrLoadModule('/src/pages/admin/AdminDashboard.jsx')).default;
  TransactionRecords = (await server.ssrLoadModule('/src/components/orders/TransactionRecords.jsx')).default;
});
beforeEach(t => {
  sessionStorage.clear(); userId = 5; products = [product]; orders = []; unread = 0; calls = []; failCatalog = false; channels = [];
  document.cookie = 'XSRF-TOKEN=test';
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    if (url.endsWith('/user')) return json({ id: userId, role: { slug: 'shopper' }, email_verified_at: '2026-10-19', profile: { first_name: 'Shopper', last_name: String(userId) } });
    if (url.endsWith('/dashboard/summary')) return json({ role: 'shopper', server_time: '2026-10-20T08:00:00Z', active_orders: orders.length, recent_active_orders: orders, unread_notifications: unread });
    if (url.endsWith('/shopper/stores')) return json({ stores: [{ store_id: 1, store_name: 'Store A', address: 'A' }, { store_id: 2, store_name: 'Store B', address: 'B' }] });
    if (url.endsWith('/payment-options')) return json({ digital: { available: channels.length > 0, channels, reason: channels.length ? null : 'Sandbox setup unavailable' } });
    if (url.includes('/pickup-hours')) return json({ hours: { date: '2026-10-21', opens_at: '10:00', closes_at: '18:00', store_opens_at: '09:00', store_closes_at: '21:00', earliest_start_at: '10:00' } });
    if (url.endsWith('/shopper/checkout/quote')) {
      const cart = JSON.parse(options.body);
      return json({ quote: { store: { store_name: 'Store A', address: 'A' }, items: [{ store_inventory_id: 7, product_name: 'Rice', quantity: 2, unit_price_centavos: 6725, line_total_centavos: 13450 }], subtotal_centavos: 13450, total_centavos: 13450, service_fee_centavos: 0, pickup_window_start_at: '2026-10-21T02:00:00Z', pickup_window_end_at: '2026-10-21T03:00:00Z', cop_claim_deadline_at: '2026-10-21T13:00:00Z', payment_method: cart.payment_method }, quote_token: 'review-token' });
    }
    if (url.endsWith('/shopper/orders') && options.method === 'POST') {
      const cart = JSON.parse(options.body);
      return json({ order: { order_id: 9, store_id: 1, store_name: 'Store A', payment_method: cart.payment_method, payment_status: 'unpaid', status: 'waiting', total_centavos: 13450, reservation_status: 'active' } }, 201);
    }
    if (url.includes('/products')) {
      if (failCatalog) return json({ message: 'Catalog unavailable' }, 503);
      const storeId = Number(url.match(/stores\/(\d+)/)[1]);
      return json({ store: { store_id: storeId, store_name: storeId === 1 ? 'Store A' : 'Store B' }, products: products.filter(row => row.store_id === storeId) });
    }
    if (url.includes('/checkout-attempts/')) return json({ order: { order_id: 9, store_id: 1, status: 'waiting', payment_status: 'unpaid', total_centavos: 13450 } });
    if (url.endsWith('/shopper/order-notifications')) return json({ notifications: [] });
    throw new Error('Unexpected request ' + url);
  });
});
afterEach(async () => { if (root) { await act(async () => root.unmount()); root = null; } });
after(async () => { await server.close(); dom.window.close(); });

test('header and dashboard open the same empty My Cart without placing an order', async () => {
  await mount();
  assert.ok(text().includes('You have no active orders.'));
  const cartButton = document.querySelector('[aria-label="Open My Cart, 0 items"]');
  await click(cartButton); assert.ok(text().includes('Your cart is empty'));
  assert.ok(button('Proceed to Checkout').disabled);
  await click(button('Dashboard')); await click(button('View Cart →'));
  assert.equal(document.querySelector('h1').textContent, 'My Cart');
  assert.equal(calls.filter(call => call.options.method === 'POST').length, 0);
});

test('Browse, My Cart, badge and dashboard share quantities and exact catalog totals across refresh', async () => {
  sessionStorage.setItem('grocerease-cart-5', JSON.stringify({ store_id: 1, items: [] }));
  await mount(); await click(button('Browse Products')); await click(button('Add to cart')); await click(button('Add to cart'));
  assert.ok(document.querySelector('[aria-label="Open My Cart, 2 items"]'));
  await click(button('View Cart')); assert.ok(text().includes('134.50')); assert.ok(text().includes('SKU: RICE'));
  await click(button('Dashboard')); assert.ok(text().includes('134.50'));
  await act(async () => root.unmount()); root = null; await mount();
  assert.ok(document.querySelector('[aria-label="Open My Cart, 2 items"]')); assert.ok(text().includes('134.50'));
  await click(button('My Cart')); await click([...document.querySelectorAll('button')].find(el => el.textContent.startsWith('Remove')));
  assert.ok(document.querySelector('[aria-label="Open My Cart, 0 items"]')); assert.deepEqual(JSON.parse(sessionStorage.getItem('grocerease-cart-5')).items, []);
});

test('another Shopper and another store never inherit the previous cart', async () => {
  sessionStorage.setItem('grocerease-cart-5', JSON.stringify({ store_id: 1, items: [{ store_inventory_id: 7, quantity: 2 }] }));
  await mount(); await click(button('Browse Products'));
  const select = document.querySelector('select');
  await act(async () => { select.value = '2'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  assert.ok(text().includes('Switching stores clears your current cart'));
  assert.ok(document.querySelector('[aria-label="Open My Cart, 2 items"]'));
  await click(button('Clear cart and switch')); assert.ok(document.querySelector('[aria-label="Open My Cart, 0 items"]'));
  assert.equal(JSON.parse(sessionStorage.getItem('grocerease-cart-5')).store_id, 2);
  await act(async () => root.unmount()); root = null; userId = 6; await mount();
  assert.ok(document.querySelector('[aria-label="Open My Cart, 0 items"]')); assert.ok(text().includes('0.00'));
});

test('failed catalog prices are unavailable and checkout stays disabled', async () => {
  sessionStorage.setItem('grocerease-cart-5', JSON.stringify({ store_id: 1, items: [{ store_inventory_id: 7, quantity: 2 }] }));
  failCatalog = true; await mount(); assert.ok(text().includes('Not available'));
  await click(button('My Cart')); assert.ok(text().includes('Catalog unavailable')); assert.ok(button('Proceed to Checkout').disabled);
});

test('saved checkout recovery clears once and notifications use the real unread count', async () => {
  const cart = { store_id: 1, items: [{ store_inventory_id: 7, quantity: 2 }] };
  sessionStorage.setItem('grocerease-cart-5', JSON.stringify(cart));
  const { saveCheckoutAttempt } = await import('../src/services/checkout.js');
  saveCheckoutAttempt(sessionStorage, 5, { ...cart, ...schedule }, key);
  unread = 4; await mount();
  assert.ok(document.querySelector('[aria-label="Open My Cart, 0 items"]'));
  assert.ok(document.querySelector('[aria-label="Notifications, 4 unread"]'));
  assert.equal(sessionStorage.getItem('grocerease-checkout-5'), null);
  await click(button('Browse Products')); await click(button('Add to cart')); await click(button('Dashboard'));
  assert.ok(document.querySelector('[aria-label="Open My Cart, 1 items"]'));
});

async function input(el, value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await settle();
}

test('header search navigates to Browse and applies the entered product search', async () => {
  sessionStorage.setItem('grocerease-cart-5', JSON.stringify({ store_id: 1, items: [] }));
  await mount(); await input(document.querySelector('[aria-label="Search products"]'), 'no matching product');
  await click(document.querySelector('[aria-label="Search products in Browse"]'));
  assert.equal(document.querySelector('h1').textContent, 'Browse Store Products');
  assert.equal(document.querySelector('[aria-label="Search store products"]').value, 'no matching product');
  assert.ok(text().includes('No matching active products'));
});

for (const method of ['cash_on_pickup', 'wallet', 'card']) test('Checkout requires a pickup window and explicit final review for ' + method, async () => {
  channels = method === 'cash_on_pickup' ? [] : ['gcash', 'card'];
  let placed = 0;
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(Checkout, { cart: { store_id: 1, items: [{ store_inventory_id: 7, quantity: 2 }] }, userId: 5, onPlaced: () => { placed++; }, onClose: () => {} })));
  await settle();
  assert.ok(button('Confirm / Place Order').disabled);
  const wallet = document.querySelector('[value="wallet"]');
  assert.equal(wallet.disabled, channels.length === 0);
  if (method !== 'cash_on_pickup') await click(document.querySelector('[value="' + method + '"]'));
  await input(document.querySelector('input[type="date"]'), schedule.pickup_date);
  const times = document.querySelectorAll('input[type="time"]');
  await input(times[0], schedule.pickup_start); await input(times[1], schedule.pickup_end);
  assert.equal(button('Review current prices and pickup schedule').disabled, false);
  await click(button('Review current prices and pickup schedule'));
  assert.equal(calls.filter(call => call.url.endsWith('/shopper/orders')).length, 0);
  const quote = calls.find(call => call.url.endsWith('/checkout/quote'));
  assert.equal(JSON.parse(quote.options.body).payment_method, method === 'cash_on_pickup' ? 'cash_on_pickup' : 'digital');
  await click(button('Confirm / Place Order'));
  assert.equal(placed, 1); assert.ok(text().includes('Order #9 is recorded at Store A'));
  const body = JSON.parse(calls.find(call => call.url.endsWith('/shopper/orders')).options.body);
  assert.equal(body.pickup_start, schedule.pickup_start); assert.equal(body.quote_token, 'review-token');
  assert.ok(body.idempotency_key); assert.equal(body.payment_status, undefined);
});

test('Admin dashboard shows loading, real zeros, and unavailable errors without sample growth or sales', async t => {
  let finish;
  t.mock.method(globalThis, 'fetch', async () => new Promise(resolve => { finish = resolve; }));
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(MemoryRouter, null, createElement(AdminDashboard))));
  assert.ok(text().includes('Loading dashboard data...'));
  const data = { role: 'admin', server_time: '2026-10-20T08:00:00Z', total_users: 0, active_orders: 0, low_stock_products: 0, cop_restricted_accounts: 0, todays_sales_centavos: 0, roles: [], low_stock_records: [], restricted_accounts: [] };
  await act(async () => finish(json(data))); await settle();
  assert.ok(text().includes('0.00')); assert.ok(text().includes('Not configured'));
  assert.equal(text().includes('vs yesterday'), false); assert.equal(text().includes('125,340'), false); assert.equal(text().includes('Maria Santos'), false);
  t.mock.method(globalThis, 'fetch', async () => json({ message: 'Database unavailable' }, 503));
  await click(button('Refresh dashboard'));
  assert.ok(text().includes('Database unavailable')); assert.ok(text().includes('Not available'));
});

test('transaction reports filter genuine records by Philippine confirmation dates and supermarket', async t => {
  t.mock.method(globalThis, 'fetch', async () => json({ transactions: [
    { transaction_id: 1, order_id: 9, store_id: 1, store_name: 'Store A', shopper_name: 'Account A', payment_method: 'cash_on_pickup', status: 'waiting', payment_status: 'paid', subtotal_centavos: 10000, service_fee_centavos: 0, amount_centavos: 10000, refund_status: 'not_required', confirmed_at: '2026-10-20 15:59:00' },
    { transaction_id: 2, order_id: 10, store_id: 2, store_name: 'Store B', shopper_name: 'Account B', payment_method: 'digital', status: 'waiting', payment_status: 'paid', subtotal_centavos: 20000, service_fee_centavos: 0, amount_centavos: 20000, refund_status: 'not_required', confirmed_at: '2026-10-20 16:01:00' },
  ] }));
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(TransactionRecords, { role: 'admin', report: true })));
  await settle(); assert.ok(text().includes('300.00'));
  await input(document.querySelector('[aria-label="Payment report from date"]'), '2026-10-21');
  assert.ok(text().includes('200.00')); assert.equal(text().includes('Transaction #1'), false);
  const stores = document.querySelector('[aria-label="Report supermarket"]');
  await act(async () => { stores.value = '1'; stores.dispatchEvent(new Event('change', { bubbles: true })); });
  assert.ok(text().includes('No confirmed transactions match this view.')); assert.ok(text().includes('0.00'));
});
