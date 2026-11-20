import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:5173/' });
for (const name of ['window', 'document', 'sessionStorage', 'HTMLElement', 'HTMLInputElement', 'Event', 'MouseEvent']) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
const { act, createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
const day = '2032-05-10';
const cart = { store_id: 1, items: [{ store_inventory_id: 7, quantity: 2 }] };
const windows = [{ pickup_start: '12:00', pickup_end: '13:00' }, { pickup_start: '13:00', pickup_end: '14:00' }];
const hours = (date = day, options = windows) => ({ date, today: day, opens_at: '08:00', closes_at: '18:00', store_opens_at: '08:00', store_closes_at: '18:00', earliest_start_at: options[0]?.pickup_start ?? null, windows: options });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
let server, Checkout, root, calls, availability, paymentAvailability, placeMode, attemptMode, placed, finishPlacement;
const onPlaced = () => { placed++; };
const props = { cart, userId: 5, onPlaced, onClose() {} };
const button = (name) => [...document.querySelectorAll('button')].find((el) => el.textContent.trim() === name);
const dateInput = () => document.querySelector('#checkout-pickup-date');
const dropdown = () => document.querySelector('#checkout-pickup-window');
const hourCalls = () => calls.filter((c) => c.url.includes('/pickup-hours'));
const quoteCalls = () => calls.filter((c) => c.url.endsWith('/checkout/quote'));
async function settle() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); }); }
async function mount(overrides = {}) {
  root ??= createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(Checkout, { ...props, ...overrides }))); await settle();
}
async function click(name) { await act(async () => button(name).click()); await settle(); }
async function choose(value) { await act(async () => { dropdown().value = value; dropdown().dispatchEvent(new Event('change', { bubbles: true })); }); await settle(); }
async function date(value) { await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(dateInput(), value); dateInput().dispatchEvent(new Event('input', { bubbles: true })); }); await settle(); }
async function focus() { await act(async () => window.dispatchEvent(new Event('focus'))); await settle(); }
const order = () => ({ order_id: 9, store_name: 'QA Store', status: 'waiting', payment_status: 'unpaid', payment_method: 'cash_on_pickup', reservation_status: 'active', total_centavos: 10000,
  pickup_window_start_at: day + 'T04:00:00Z', pickup_window_end_at: day + 'T05:00:00Z' });
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
  Checkout = (await server.ssrLoadModule('/src/components/Shoppers/ShopperCheckout.jsx')).default;
});
beforeEach((t) => {
  calls = []; placed = 0; sessionStorage.clear(); document.cookie = 'XSRF-TOKEN=test';
  availability = async (url) => json({ store_id: Number(url.pathname.match(/stores\/(\d+)/)[1]), hours: hours(url.searchParams.get('date') || day) });
  paymentAvailability = async () => json({ digital: { available: false, channels: [], reason: 'Configure the prepaid holding policy first.' } });
  placeMode = 'success'; attemptMode = 'missing'; finishPlacement = null;
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    if (url.includes('/pickup-hours')) return availability(new URL(url, 'http://localhost:5173'), options);
    if (url.endsWith('/cop-status')) return json({ cop: { allowed: true, policy: { maximum_centavos: 250000 } } });
    if (url.includes('/payment-options')) return paymentAvailability(url, options);
    if (url.includes('/checkout-attempts/')) return attemptMode === 'found' ? json({ order: order() }) : json({ message: 'Not found' }, 404);
    if (url.endsWith('/checkout/quote')) return json({ quote_token: 'reviewed-token', quote: { cop_policy: { maximum_centavos: 250000 }, store: { store_name: 'QA Store', address: 'A' }, items: [], subtotal_centavos: 10000, total_centavos: 10000, service_fee_centavos: 0, payment_method: 'cash_on_pickup', pickup_window_start_at: day + 'T04:00:00Z', pickup_window_end_at: day + 'T05:00:00Z', cop_claim_deadline_at: day + 'T10:00:00Z' } });
    if (url.endsWith('/shopper/orders')) {
      if (placeMode === 'deferred') return new Promise((resolve) => { finishPlacement = resolve; });
      if (placeMode === 'network') throw new TypeError('Connection lost after sending');
      if (placeMode === 'stale') return json({ message: 'Window changed', errors: { pickup_start: ['Select a new pickup window.'] } }, 422);
      return json({ order: order() }, 201);
    }
    throw new Error('Unexpected request: ' + url);
  });
});
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; });
after(async () => { await server.close(); dom.window.close(); });

test('server date and options drive the dropdown and each choice sends an exact paired schedule', async () => {
  await mount();
  assert.equal(dateInput().value, day); assert.equal(hourCalls().length, 1);
  assert.match(document.body.textContent, /Maximum .*2,500/);
  assert.equal(document.querySelectorAll('input[type="time"]').length, 0);
  assert.equal(dropdown().value, ''); assert.match(dropdown().textContent, /12:00 PM – 1:00 PM/);
  assert.equal(button('Review current prices and pickup schedule').disabled, true);
  await choose('12:00/13:00'); await click('Review current prices and pickup schedule');
  const payload = JSON.parse(quoteCalls()[0].options.body);
  assert.equal(payload.pickup_date, day); assert.equal(payload.pickup_start, '12:00'); assert.equal(payload.pickup_end, '13:00');
  assert.equal(button('Confirm / Place Order').disabled, false);
  await choose('13:00/14:00'); assert.equal(button('Confirm / Place Order').disabled, true);
  await click('Review current prices and pickup schedule'); await click('Confirm / Place Order'); assert.equal(placed, 1);
  const placedPayload = JSON.parse(calls.find((c) => c.url.endsWith('/shopper/orders')).options.body);
  assert.equal(placedPayload.pickup_start, '13:00'); assert.equal(placedPayload.pickup_end, '14:00');
});

test('date changes clear options and cancel/ignore a slow response from the previous date', async () => {
  await mount(); await choose('12:00/13:00');
  let finish;
  availability = async (url) => url.searchParams.get('date') === '2032-05-11' ? new Promise((resolve) => { finish = resolve; }) : json({ store_id: 1, hours: hours('2032-05-12', windows.slice(1)) });
  await date('2032-05-11'); assert.equal(dropdown().disabled, true); assert.equal(dropdown().options.length, 1);
  assert.match(document.body.textContent, /Loading pickup windows/);
  await date('2032-05-12'); assert.equal(dropdown().value, '');
  await act(async () => finish(json({ store_id: 1, hours: hours('2032-05-11') }))); await settle();
  assert.equal(dateInput().value, '2032-05-12'); assert.equal(dropdown().options.length, 2); assert.equal(dropdown().options[1].value, '13:00/14:00');
  assert.equal(hourCalls()[1].options.signal.aborted, true);
});

test('empty, failed, retry and cleared-date states remain distinct without automatically selecting a window', async () => {
  availability = async () => json({ store_id: 1, hours: hours(day, []) }); await mount();
  assert.match(document.body.textContent, /No pickup windows available for this date. Choose another date./);
  assert.equal(dropdown().disabled, true);
  availability = async () => json({ message: 'Hours unavailable' }, 503); await date('2032-05-11');
  assert.match(document.body.textContent, /Hours unavailable/); assert.ok(button('Retry pickup windows'));
  availability = async () => json({ store_id: 1, hours: hours('2032-05-11') }); await click('Retry pickup windows');
  assert.equal(dropdown().disabled, false); assert.equal(dropdown().value, '');
  await date(''); assert.equal(dateInput().value, ''); assert.equal(dropdown().options.length, 1);
});

test('focus refresh preserves an offered selection but invalidates review and explains a removed selection', async () => {
  await mount(); await choose('12:00/13:00'); await click('Review current prices and pickup schedule');
  await focus(); assert.equal(dropdown().value, '12:00/13:00'); assert.equal(button('Confirm / Place Order').disabled, true);
  availability = async () => json({ store_id: 1, hours: hours(day, windows.slice(1)) }); await focus();
  assert.equal(dropdown().value, ''); assert.match(document.body.textContent, /window is no longer available/);
  assert.equal(button('Review current prices and pickup schedule').disabled, true);
});

test('a stale placement refreshes availability and requires a new explicit selection and review', async () => {
  await mount(); await choose('12:00/13:00'); await click('Review current prices and pickup schedule');
  const before = hourCalls().length; placeMode = 'stale'; await click('Confirm / Place Order');
  assert.ok(hourCalls().length > before); assert.equal(dropdown().value, '');
  assert.equal(button('Confirm / Place Order').disabled, true); assert.match(document.body.textContent, /Select a new pickup window/);
});

test('uncertain placement freezes selection and focus refresh until the original attempt is recovered', async () => {
  await mount(); await choose('12:00/13:00'); await click('Review current prices and pickup schedule');
  placeMode = 'network'; await click('Confirm / Place Order');
  const saved = JSON.parse(sessionStorage.getItem('grocerease-checkout-5')), count = hourCalls().length;
  assert.equal(dateInput().closest('fieldset').disabled, true); await focus(); assert.equal(hourCalls().length, count);
  assert.equal(JSON.parse(sessionStorage.getItem('grocerease-checkout-5')).key, saved.key);
  attemptMode = 'found'; availability = async () => json({ store_id: 1, hours: hours(day, []) });
  await click('Check original order and refresh review'); assert.equal(placed, 1); assert.equal(hourCalls().length, count);
  assert.equal(calls.filter((c) => c.url.endsWith('/shopper/orders')).length, 1);
  assert.ok(calls.some((c) => c.url.endsWith('/checkout-attempts/' + saved.key)));
});

test('returning to checkout recovers a saved original attempt before asking for any new availability', async () => {
  const key = '04a87418-5ada-4bee-9c35-3cb608cfa525';
  const { saveCheckoutAttempt } = await import('../src/services/checkout.js');
  saveCheckoutAttempt(sessionStorage, 5, { ...cart, pickup_date: day, pickup_start: '12:00', pickup_end: '13:00' }, key);
  attemptMode = 'found'; availability = async () => json({ message: 'No new slots' }, 422);
  await mount(); assert.equal(placed, 1); assert.equal(hourCalls().length, 0);
});

test('a pending placement keeps the reviewed pair immutable and blocks focus refresh', async () => {
  await mount(); await choose('12:00/13:00'); await click('Review current prices and pickup schedule');
  placeMode = 'deferred'; await click('Confirm / Place Order'); const before = hourCalls().length;
  await focus(); await choose('13:00/14:00');
  assert.equal(dropdown().value, '12:00/13:00'); assert.equal(hourCalls().length, before);
  assert.equal(JSON.parse(sessionStorage.getItem('grocerease-checkout-5')).schedule.pickup_end, '13:00');
  await act(async () => finishPlacement(json({ order: order() }, 201))); await settle(); assert.equal(placed, 1);
});

test('a confirmed missing uncertain attempt refreshes windows without automatically quoting or changing the date', async () => {
  await mount(); await choose('12:00/13:00'); await click('Review current prices and pickup schedule');
  placeMode = 'network'; await click('Confirm / Place Order');
  availability = async () => json({ store_id: 1, hours: hours(day, []) });
  const quoted = quoteCalls().length;
  await click('Check original order and refresh review');
  assert.equal(sessionStorage.getItem('grocerease-checkout-5'), null); assert.equal(quoteCalls().length, quoted);
  assert.equal(dateInput().value, day); assert.match(document.body.textContent, /No pickup windows available/);
  assert.equal(button('Review current prices and pickup schedule').disabled, true); assert.equal(placed, 0);
});

test('store changes discard the previous selection and reviewed quote', async () => {
  await mount(); await choose('12:00/13:00'); await click('Review current prices and pickup schedule');
  await mount({ cart: { ...cart, store_id: 2 } });
  assert.equal(dropdown().value, ''); assert.equal(button('Confirm / Place Order').disabled, true);
  assert.match(hourCalls().at(-1).url, /stores\/2\/pickup-hours/);
});

test('returning to checkout refreshes GCash and uses the wallet API category for quote and order', async () => {
  await mount();
  assert.equal(document.querySelector('input[value="wallet"]').disabled, true);
  assert.match(document.body.textContent, /Configure the prepaid holding policy first/);
  paymentAvailability = async () => json({ digital: { available: true, provider: 'xendit', channels: ['gcash'], reason: null } });
  await focus();
  const gcash = document.querySelector('input[value="wallet"]');
  assert.equal(gcash.disabled, false); assert.match(gcash.parentElement.textContent, /GCash Xendit \(Test\)/);
  assert.equal(document.querySelector('input[value="card"]').disabled, true);
  await act(async () => gcash.click()); await settle();
  await choose('12:00/13:00'); await click('Review current prices and pickup schedule');
  const payload = JSON.parse(quoteCalls().at(-1).options.body);
  assert.equal(payload.payment_method, 'digital'); assert.equal(payload.payment_channel, 'wallet');
  assert.equal(gcash.checked, true);
  await click('Confirm / Place Order');
  const placedPayload = JSON.parse(calls.find(call => call.url.endsWith('/shopper/orders')).options.body);
  assert.equal(placedPayload.payment_method, 'digital'); assert.equal(placedPayload.payment_channel, 'wallet');
});

test('a fresh payment check ignores an older unavailable result and can retry network failures', async () => {
  let finish;
  paymentAvailability = async () => new Promise(resolve => { finish = resolve; });
  await mount();
  assert.match(document.querySelector('input[value="wallet"]').parentElement.textContent, /checking/);
  assert.equal(button('Refresh payment methods').disabled, true);
  paymentAvailability = async () => json({ digital: { available: true, provider: 'xendit', channels: ['gcash'] } });
  await focus();
  const requests = () => calls.filter(call => call.url.includes('/payment-options'));
  assert.equal(requests()[0].options.signal.aborted, true);
  await act(async () => finish(json({ digital: { available: false, channels: [], reason: 'Old settings' } }))); await settle();
  assert.equal(document.querySelector('input[value="wallet"]').disabled, false);
  assert.doesNotMatch(document.body.textContent, /Old settings/);
  paymentAvailability = async () => { throw new TypeError('Connection lost'); };
  await click('Refresh payment methods');
  assert.match(document.body.textContent, /Connection lost/);
  assert.equal(document.querySelector('input[value="wallet"]').disabled, true);
  paymentAvailability = async () => json({ digital: { available: true, provider: 'xendit', channels: ['gcash'] } });
  await click('Refresh payment methods');
  assert.equal(document.querySelector('input[value="wallet"]').disabled, false);
  assert.equal(requests().length, 4);
  assert.equal(quoteCalls().length, 0);
  assert.equal(calls.filter(call => call.url.endsWith('/shopper/orders')).length, 0);
});

test('phone tab visibility rechecks payment availability and switching stores keeps methods isolated', async t => {
  const previous = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  let visibility = 'hidden';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  t.after(() => { if (previous) Object.defineProperty(document, 'visibilityState', previous); else delete document.visibilityState; });
  await mount();
  paymentAvailability = async url => json({ digital: url.includes('/stores/1/')
    ? { available: true, provider: 'xendit', channels: ['gcash'] }
    : { available: false, channels: [], reason: 'This supermarket has no configured Xendit TEST business.' } });
  const requests = () => calls.filter(call => call.url.includes('/payment-options'));
  await act(async () => document.dispatchEvent(new Event('visibilitychange'))); await settle();
  assert.equal(requests().length, 1);
  visibility = 'visible';
  await act(async () => document.dispatchEvent(new Event('visibilitychange'))); await settle();
  assert.equal(requests().length, 2);
  assert.equal(document.querySelector('input[value="wallet"]').disabled, false);
  await mount({ cart: { ...cart, store_id: 2 } });
  assert.doesNotMatch(document.querySelector('input[value="wallet"]').parentElement.textContent, /GCash Xendit/);
  assert.equal(document.querySelector('input[value="wallet"]').disabled, true);
  assert.match(document.body.textContent, /no configured Xendit TEST business/);
});
