import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:5173/' });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Event', 'MouseEvent']) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
let server, Workspace, root, data, writes;
const week = (period) => Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i + 1, period && { ...period }]));
const json = (value) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const start = () => document.querySelector('[aria-label="Monday pickup service opening time"]');
const end = () => document.querySelector('[aria-label="Monday pickup service closing time"]');
const byButton = (name) => [...document.querySelectorAll('button')].find((el) => el.textContent.trim() === name || el.getAttribute('aria-label') === name);
const values = (el) => [...el.options].map((option) => option.value);
async function settle() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); }); }
async function mount(readOnly = false) {
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(Workspace, { readOnly, storeId: 1 }))); await settle();
}
async function click(el) { await act(async () => el.click()); await settle(); }
async function select(el, value) { await act(async () => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); }); await settle(); }
async function time(label, value) {
  const el = document.querySelector(`[aria-label="${label}"]`);
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); }); await settle();
}
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
  Workspace = (await server.ssrLoadModule('/src/components/admin/StorePickupSettings.jsx')).PickupSettingsWorkspace;
});
beforeEach((t) => {
  writes = []; document.cookie = 'XSRF-TOKEN=test';
  data = { store_id: 1, store: { store_name: 'QA Store', address: 'A' }, operating_hours: week({ opens_at: '09:00', closes_at: '20:30' }),
    pickup_service_hours: week({ opens_at: '10:00', closes_at: '19:30' }), pickup_preparation_minutes: 60, pickup_window_minutes: 60, paid_order_holding_hours: null, closures: [], affected_orders: [], schedule_history: [] };
  t.mock.method(window, 'confirm', () => true);
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    if (options.method === 'PUT') { const body = JSON.parse(options.body); writes.push(body); data = { ...data, ...body }; }
    return json(data);
  });
});
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; });
after(async () => { await server.close(); dom.window.close(); });

test('pickup service uses bounded dropdowns with readable labels and adjustable default gaps', async () => {
  await mount(); assert.equal(start().tagName, 'SELECT'); assert.equal(end().tagName, 'SELECT');
  assert.equal(start().value, '10:00'); assert.equal(end().value, '19:30');
  assert.match(start().textContent, /10:00 AM/); assert.match(end().textContent, /7:30 PM/);
  assert.ok(values(start()).filter(Boolean).every((value) => value >= '09:00' && value < '19:30'));
  await select(start(), '09:30'); await select(end(), '20:00'); await click(byButton('Save pickup settings'));
  assert.deepEqual(writes[0].pickup_service_hours[1], { opens_at: '09:30', closes_at: '20:00' });
  await click(byButton('Use suggested Monday pickup hours'));
  assert.equal(start().value, '10:00'); assert.equal(end().value, '19:30');
});

test('changing store hours updates suggested hours and preserves valid custom choices', async () => {
  await mount(); await time('Monday store open opening time', '10:00');
  assert.equal(start().value, '11:00'); assert.equal(end().value, '19:30');
  await select(start(), '12:00'); await select(end(), '17:00');
  await time('Monday store open closing time', '19:00');
  assert.equal(start().value, '12:00'); assert.equal(end().value, '17:00');
  await time('Monday store open closing time', '16:00');
  assert.equal(start().value, '11:00'); assert.equal(end().value, '15:00');
  assert.ok(values(end()).filter(Boolean).every((value) => value <= '16:00'));
});

test('closing and reopening a day clears pickup hours and suggests a valid new range', async () => {
  await mount(); const storeToggle = () => [...document.querySelectorAll('label')].find((label) => label.textContent.trim() === 'Monday store open').querySelector('input');
  await click(storeToggle()); assert.equal(start(), null);
  await click(byButton('Save pickup settings')); assert.equal(writes[0].pickup_service_hours[1], null);
  await click(storeToggle()); await time('Monday store open opening time', '09:00'); await time('Monday store open closing time', '20:30');
  assert.equal(start().value, '10:00'); assert.equal(end().value, '19:30');
});

test('saved minute values and existing fallback hours survive unrelated policy edits', async () => {
  data.pickup_service_hours = week({ opens_at: '10:17', closes_at: '18:43' });
  await mount(); assert.equal(start().value, '10:17'); assert.equal(end().value, '18:43');
  await select(document.querySelector('[aria-label="Preparation time"]'), '90'); await click(byButton('Save pickup settings'));
  assert.equal(writes[0].pickup_service_hours[1].opens_at, '10:17'); assert.equal(writes[0].pickup_service_hours[1].closes_at, '18:43');
  await act(async () => root.unmount()); root = null; data.pickup_service_hours = null;
  await mount(); assert.equal(start().value, '09:00'); assert.equal(end().value, '20:30');
  await click(byButton('Save pickup settings')); assert.equal(writes.at(-1).pickup_service_hours[1].opens_at, '09:00');
});

test('Admin oversight shows saved hours with no editing dropdowns or suggested-hours actions', async () => {
  await mount(true); assert.equal(document.querySelectorAll('select').length, 0);
  assert.match(document.body.textContent, /10:00–19:30/); assert.equal(byButton('Use suggested Monday pickup hours'), undefined);
  assert.equal(writes.length, 0);
});
