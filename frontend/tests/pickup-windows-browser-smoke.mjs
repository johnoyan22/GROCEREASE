// Real browser rendering of the production checkout/settings components with mocked HTTP.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const output = fileURLToPath(new URL('../../tmp/pickup-windows-browser/', import.meta.url));
await mkdir(output, { recursive: true });
const entry = '/__pickup-window-browser.js';
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0 }, plugins: [{
  name: 'pickup-window-browser-fixture',
  resolveId(id) { if (id === entry) return '\0pickup-window-browser.js'; },
  load(id) {
    if (id !== '\0pickup-window-browser.js') return;
    return `import React from 'react'; import { createRoot } from 'react-dom/client'; import '/src/index.css';
      import Checkout from '/src/components/Shoppers/ShopperCheckout.jsx';
      import { PickupSettingsWorkspace } from '/src/components/admin/StorePickupSettings.jsx';
      const mode = new URLSearchParams(location.search).get('view');
      const node = mode === 'settings' || mode === 'admin'
        ? React.createElement('main', {className:'mx-auto max-w-5xl p-6'}, React.createElement('div', {className:'rounded-2xl border border-gray-200 bg-white p-6'}, React.createElement(PickupSettingsWorkspace, {readOnly:mode === 'admin',storeId:1})))
        : React.createElement(Checkout, {cart:{store_id:1,items:[{store_inventory_id:7,quantity:2}]},userId:5,onPlaced:order=>{window.placedOrder=order},onClose:()=>{}});
      createRoot(document.getElementById('root')).render(node);`;
  },
  configureServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith('/__pickup-window-browser?')) return next();
      const html = await vite.transformIndexHtml('/__pickup-window-browser', `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><div id="root"></div><script type="module" src="${entry}"></script></body></html>`);
      res.setHeader('Content-Type', 'text/html'); res.end(html);
    });
  },
}] });
await server.listen();
const origin = server.resolvedUrls.local[0].replace(/\/$/, '');
const day = '2032-05-10', store = { store_id: 1, store_name: 'QA Store', address: 'QA only', status: 'active' };
const week = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i + 1, { opens_at: '08:00', closes_at: '18:00' }]));
let browser, activePage, lastErrors;
try {
  browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL || 'msedge', headless: true });
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'America/Los_Angeles' });
    await context.addCookies([{ name: 'XSRF-TOKEN', value: 'qa', url: origin }]);
    let policy = { operating_hours: week, pickup_service_hours: week, paid_order_holding_hours: null, pickup_preparation_minutes: 60, pickup_window_minutes: 60 };
    let history = [], availabilityMode = 'normal';
    const writes = [], errors = []; lastErrors = errors;
    const settings = () => ({ ...policy, store_id: 1, store, closures: [], schedule_history: history, affected_orders: [] });
    await context.route('http://localhost:8000/**', async (route) => {
      const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method();
      const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Accept, Content-Type, X-XSRF-TOKEN', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS' };
      const respond = (data, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(data) });
      if (method === 'OPTIONS') return respond({});
      if (method !== 'GET') writes.push({ path, method, body: req.postDataJSON() });
      if (path === '/sanctum/csrf-cookie') return respond({});
      if (path.endsWith('/payment-options')) return respond({ available: false, channels: [], reason: 'Digital payments unavailable in this fixture.' });
      if (path.endsWith('/pickup-hours')) {
        if (availabilityMode === 'error') return respond({ message: 'QA availability failed' }, 503);
        const windows = availabilityMode === 'empty' ? [] : policy.pickup_window_minutes === 120 ? [{ pickup_start: '12:00', pickup_end: '14:00' }] : [{ pickup_start: '12:00', pickup_end: '13:00' }, { pickup_start: '13:00', pickup_end: '14:00' }];
        return respond({ store_id: 1, hours: { date: url.searchParams.get('date') || day, today: day, server_now: day + 'T10:15:00+08:00', opens_at: '08:00', closes_at: '18:00', store_opens_at: '08:00', store_closes_at: '18:00', earliest_start_at: windows[0]?.pickup_start ?? null, windows } });
      }
      if (path === '/api/shopper/checkout/quote') {
        const body = req.postDataJSON(); assert.equal(body.pickup_date, day); assert.equal(body.pickup_start, '12:00'); assert.equal(body.pickup_end, '13:00');
        return respond({ quote_token: 'browser-review', quote: { store, items: [{ store_inventory_id: 7, product_name: 'Rice', quantity: 2, unit_price_centavos: 5000, line_total_centavos: 10000 }], subtotal_centavos: 10000, total_centavos: 10000, service_fee_centavos: 0, payment_method: 'cash_on_pickup', pickup_window_start_at: day + 'T04:00:00Z', pickup_window_end_at: day + 'T05:00:00Z', cop_claim_deadline_at: day + 'T10:00:00Z' } });
      }
      if (path === '/api/shopper/orders') return respond({ order: { order_id: 9, store_name: 'QA Store', payment_method: 'cash_on_pickup', payment_status: 'unpaid', status: 'waiting', reservation_status: 'active', total_centavos: 10000, pickup_window_start_at: day + 'T04:00:00Z', pickup_window_end_at: day + 'T05:00:00Z' } }, 201);
      if (path === '/api/supervisor/pickup-settings') {
        if (method === 'PUT') {
          const body = req.postDataJSON(); assert.equal(body.pickup_preparation_minutes, 90); assert.equal(body.pickup_window_minutes, 120); assert.equal(body.store_id, undefined);
          assert.deepEqual(body.pickup_service_hours[1], { opens_at: '09:30', closes_at: '20:00' });
          history = [{ id: 1, changed_by_user_id: 3, created_at: '2032-05-10T02:15:00Z', previous_settings: policy, new_settings: body }]; policy = body;
        }
        return respond({ ...settings(), message: 'Pickup settings saved.' });
      }
      if (path === '/api/admin/stores/1/pickup-settings') return respond(settings());
      errors.push(method + ' ' + path); return respond({ message: 'Unexpected QA request' }, 500);
    });
    const page = await context.newPage(); activePage = page; page.setDefaultTimeout(15000); page.on('pageerror', (error) => errors.push(error.message)); page.on('dialog', (dialog) => dialog.accept());
    const shot = (name) => page.screenshot({ path: output + `/${width}-${name}.png` });
    const noOverflow = async () => assert.equal(await page.locator('body').evaluate((el) => el.scrollWidth <= innerWidth), true);
    await page.goto(origin + '/__pickup-window-browser?view=checkout');
    const date = page.getByLabel('Pickup date', { exact: true }), window = page.getByLabel('Pickup window', { exact: true });
    await window.getByRole('option', { name: '12:00 PM – 1:00 PM' }).waitFor({ state: 'attached' });
    assert.equal(await date.inputValue(), day); assert.equal(await page.locator('input[type="time"]').count(), 0);
    assert.equal(await window.inputValue(), ''); await window.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    assert.equal(await window.inputValue(), '12:00/13:00');
    await page.getByRole('heading', { name: 'Checkout', exact: true }).click(); await shot('checkout'); const box = await page.getByRole('dialog').boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
    await page.getByRole('button', { name: 'Review current prices and pickup schedule', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm / Place Order', exact: true }).click();
    await page.getByText('Order #9 is recorded at QA Store.', { exact: true }).waitFor();
    await page.getByText(/Pickup: .*12:00.*1:00/).waitFor(); await noOverflow();
    const placed = writes.find((entry) => entry.path === '/api/shopper/orders').body;
    assert.equal(placed.pickup_start, '12:00'); assert.equal(placed.pickup_end, '13:00');
    await page.goto(origin + '/__pickup-window-browser?view=settings');
    const pickupStart = page.getByLabel('Monday pickup service opening time', { exact: true }), pickupEnd = page.getByLabel('Monday pickup service closing time', { exact: true });
    assert.equal(await pickupStart.evaluate((el) => el.tagName), 'SELECT');
    await page.getByLabel('Monday store open opening time', { exact: true }).fill('09:00');
    await page.getByLabel('Monday store open closing time', { exact: true }).fill('20:30');
    assert.equal(await pickupStart.inputValue(), '10:00'); assert.equal(await pickupEnd.inputValue(), '19:30');
    const starts = await pickupStart.locator('option').evaluateAll((items) => items.map((item) => item.value).filter(Boolean));
    assert.ok(starts.every((time) => time >= '09:00' && time < '19:30'));
    await pickupStart.selectOption('09:30'); await pickupEnd.selectOption('20:00');
    await page.getByRole('button', { name: 'Use suggested Monday pickup hours', exact: true }).click();
    assert.equal(await pickupStart.inputValue(), '10:00'); assert.equal(await pickupEnd.inputValue(), '19:30');
    await pickupStart.selectOption('09:30'); await pickupEnd.selectOption('20:00'); await pickupStart.scrollIntoViewIfNeeded(); await shot('pickup-hours-dropdowns');
    const prep = page.getByLabel('Preparation time', { exact: true }), length = page.getByLabel('Pickup window length', { exact: true });
    await prep.selectOption('90'); await length.selectOption('120'); await prep.scrollIntoViewIfNeeded(); await shot('supervisor-settings');
    const a = await prep.boundingBox(), b = await length.boundingBox(); assert.equal(Math.abs(a.y - b.y) < 2, width >= 640);
    await page.getByRole('button', { name: 'Save pickup settings', exact: true }).click(); await page.getByText('Pickup settings saved.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Refresh settings', exact: true }).click(); await page.waitForFunction(() => document.querySelector('select[aria-label="Preparation time"]')?.value === '90');
    assert.equal(await length.inputValue(), '120');
    assert.equal(await pickupStart.inputValue(), '09:30'); assert.equal(await pickupEnd.inputValue(), '20:00');
    await page.getByText('Schedule-change audit history (latest 50)', { exact: true }).click();
    await page.getByText(/Preparation time: 1 hour.*1 hour 30 minutes/).waitFor(); await page.getByText(/Pickup window length: 1 hour.*2 hours/).waitFor(); await noOverflow();
    await page.goto(origin + '/__pickup-window-browser?view=admin');
    await page.getByText('Preparation time: 1 hour 30 minutes', { exact: true }).waitFor(); await page.getByText('Pickup window length: 2 hours', { exact: true }).waitFor();
    await page.getByRole('cell', { name: '09:30–20:00', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Save pickup settings', exact: true }).count(), 0); assert.equal(await page.locator('select').count(), 0);
    await noOverflow();
    await page.evaluate(() => sessionStorage.clear()); availabilityMode = 'empty';
    await page.goto(origin + '/__pickup-window-browser?view=checkout'); await page.getByText('No pickup windows available for this date. Choose another date.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Review current prices and pickup schedule', exact: true }).isDisabled(), true);
    availabilityMode = 'error'; await date.fill('2032-05-11'); await page.getByRole('button', { name: 'Retry pickup windows', exact: true }).waitFor();
    availabilityMode = 'normal'; await page.getByRole('button', { name: 'Retry pickup windows', exact: true }).click();
    await window.getByRole('option', { name: '12:00 PM – 2:00 PM' }).waitFor({ state: 'attached' }); assert.equal(await window.inputValue(), '');
    assert.deepEqual(errors, []); console.log(`PASS: ${width}px checkout dropdown/keyboard/COP paired schedule, empty/error/retry, Supervisor settings persistence/audit and read-only Admin; browser timezone America/Los_Angeles.`);
    await context.close();
  }
} catch (error) { console.error('Browser errors:', JSON.stringify(lastErrors)); if (activePage && !activePage.isClosed()) { console.error((await activePage.locator('body').innerText()).slice(0, 1500)); await activePage.screenshot({ path: output + '/failure.png' }); } throw error; } finally { await browser?.close(); await server.close(); }
