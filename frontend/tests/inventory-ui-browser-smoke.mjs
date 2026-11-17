// Real responsive browser checks with mocked HTTP only. Never writes working data.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const output = fileURLToPath(new URL('../../tmp/inventory-ui-browser/', import.meta.url));
await mkdir(output, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
const origin = server.resolvedUrls.local[0].replace(/\/$/, '');
const store = { store_id: 1, store_name: 'QA Store', address: 'Mocked browser QA', status: 'active' };
const correction = { id: 71, inventory_batch_id: 24, batch_no: 'B-000024', product_name: 'Water', sku: 'WATER-QA', selling_unit: 'bottle',
  observed_remaining_quantity: 50, requested_remaining_quantity: 40, quantity_change: -10, current_remaining_quantity: 50,
  current_allocated_quantity: 2, observed_allocated_quantity: 2, status: 'pending', received_date: '2026-11-10', expiry_date: '2027-01-01',
  stock_condition: 'active', reason: 'Shelf count confirmed', requested_by_name: 'QA Worker', created_at: '2026-11-17T00:00:00Z' };
const adjustments = [correction,
  { ...correction, id: 72, batch_no: 'B-000025', requested_remaining_quantity: 1, quantity_change: -49, is_stale: true, reconciliation_required: true },
  { ...correction, id: 73, status: 'rejected', decided_at: '2026-11-17T01:00:00Z', decided_by_name: 'QA Supervisor', decision_note: 'Please recount.' },
  { ...correction, id: 74, status: 'approved', decided_at: '2026-11-17T01:00:00Z', decided_by_name: 'QA Supervisor', decision_note: 'Verified count.' },
  { id: 1, is_legacy: true, product_name: 'Legacy rice', sku: 'RICE', status: 'pending', observed_hard_stock_qty: 100, requested_hard_stock_qty: 95, reason: 'Historical count' }];
const receipts = ['pending', 'approved', 'rejected'].map((status, i) => ({ id: i + 1, product_name: 'Coke', sku: 'COKE', size: '1.5 L', selling_unit: 'bottle',
  quantity: 100, received_date: '2026-11-10', expiry_date: '2027-01-01', description: 'QA delivery ' + status, status,
  requested_by_user_id: 3, created_at: '2026-11-17T00:00:00Z', decided_at: i ? '2026-11-17T01:00:00Z' : null,
  decided_by_user_id: i ? 4 : null, decision_note: i === 2 ? 'Rejected duplicate delivery.' : null }));
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: process.env.QA_BROWSER_CHANNEL || 'msedge' });
  for (const width of [1440, 390, 320]) {
    let role = 'inventory_worker';
    const errors = [], calls = [];
    const order = { order_id: 90, store_id: 1, store_name: 'QA Store', shopper_name: 'QA Shopper', created_at: '2026-11-17T00:00:00Z',
      status: 'waiting', claim_status: 'awaiting_preparation', reservation_status: 'active', payment_method: 'cash_on_pickup', payment_status: 'unpaid',
      subtotal_centavos: 2000, service_fee_centavos: 0, total_centavos: 2000, pickup: {}, assignments: [], history: [],
      items: [{ order_item_id: 1, product_name: 'Water', sku: 'WATER-QA', quantity: 2, prepared_qty: 0, selling_unit: 'bottle',
        unit_price_centavos: 1000, line_total_centavos: 2000, picking_batches: [{ batch_id: 24, batch_no: 'B-000024', reference: 'ORIGINAL-REFERENCE',
          quantity: 2, expiry_date: '2027-01-01', eligible: true, allocation_status: 'reserved' }] }] };
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addCookies([{ name: 'XSRF-TOKEN', value: 'qa-token', url: origin }]);
    await context.route('http://localhost:8000/**', async (route) => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method();
      const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Accept, Content-Type, X-XSRF-TOKEN', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS' };
      const respond = (data, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(data) });
      if (method === 'OPTIONS') return respond({});
      const body = request.postDataJSON(); calls.push({ path, method, body });
      if (path === '/api/user') return respond({ id: 3, role: { slug: role, name: role }, profile: { first_name: 'QA', last_name: 'Staff' } });
      if (path === '/api/staff/store') return respond({ store });
      if (path === '/sanctum/csrf-cookie') return respond({});
      if (path === '/api/inventory/items') return respond({ store, inventory: [] });
      if (path === '/api/inventory/stock-adjustments') return respond({ store, adjustments });
      if (path === '/api/inventory/stock-receipts') return respond({ store, receipts });
      if (path === '/api/inventory/low-stock') return respond({ store, inventory: [], pagination: { current_page: 1, last_page: 1, total: 0 } });
      if (path === '/api/staff/low-stock-notifications') return respond({ store, notifications: [], pagination: { current_page: 1, last_page: 1, total: 0 } });
      if (path === '/api/inventory/low-stock-reports') return respond({ store, reports: [] });
      if (path === '/api/inventory/availability-history') return respond({ store, history: [] });
      if (path === '/api/dashboard/summary') return respond({ store, role, products_managed: 2, inventory_records: 2,
        physical_units: 150, reserved_units: 2, available_units: 148, low_stock_products: 0, pending_stock_approvals: 3, active_orders: 1,
        stock_statuses: { in_stock: 2, low_stock: 0, out_of_stock: 0, inactive: 0 }, recent_adjustments: [], recent_reports: [], recent_activity: [] });
      if (path === '/api/staff/orders') return respond({ store, server_time: '2026-11-17T01:00:00Z', orders: [order] });
      if (path === '/api/supervisor/workers') return respond({ store, workers: [{ worker_id: 5, full_name: 'QA Picker', work_type: 'picker_packer',
        status: 'active', availability: order.assignments.some((a) => a.status === 'assigned') ? 'Busy' : 'Available', active_task_count: order.assignments.some((a) => a.status === 'assigned') ? 1 : 0 }] });
      if (path === '/api/supervisor/orders/90/worker') {
        assert.equal(body.worker_id, 5); order.assignments = [{ assignment_id: 1, worker_id: 5, worker_name: 'QA Picker', status: 'assigned', assigned_by_user_id: 3 }];
        return respond({ message: 'Worker assigned.' });
      }
      if (path === '/api/staff/orders/90/preparation') {
        assert.deepEqual(body.items, [{ order_item_id: 1, prepared_qty: 2 }]); order.items[0].prepared_qty = 2;
        return respond({ message: 'Checklist saved.' });
      }
      if (path === '/api/supervisor/orders/90/preparation-completion') { order.assignments[0].status = 'completed'; return respond({ message: 'Preparation reviewed.' }); }
      if (path === '/api/supervisor/orders/90/status') {
        order.status = body.status;
        if (body.status === 'ready_for_pickup') order.claim_status = 'claimable';
        return respond({ message: 'Order status saved.' });
      }
      errors.push('Unexpected HTTP ' + method + ' ' + path); return respond({ message: 'Unexpected QA request' }, 500);
    });
    const page = await context.newPage(); page.on('pageerror', (e) => errors.push(e.message));
    const nav = () => page.getByRole('navigation', { name: 'Inventory navigation' });
    const correctionButton = () => page.getByRole('button', { name: 'Stock Correction', exact: true });
    const additionButton = () => page.getByRole('button', { name: 'Stock Addition', exact: true });
    const screenshot = (name) => page.screenshot({ path: output + `/${width}-${name}.png` });
    const pressed = async (button) => {
      await button.and(page.locator('[aria-pressed="true"]')).waitFor();
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
    };
    async function openWorkerMenu() {
      if (width >= 1024) return;
      await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('nav[aria-label="Inventory navigation"]').closest('aside').getBoundingClientRect().left >= -0.5);
    }
    await page.goto(origin + '/inventory/verifications?section=correction&context=qa&page=9&search=obsolete&status=rejected');
    await page.getByRole('heading', { name: 'Stock Request', exact: true }).waitFor();
    await correctionButton().waitFor(); await pressed(correctionButton());
    assert.equal(await nav().getByRole('link', { name: 'Stock Verification Requests', exact: true }).getAttribute('aria-current'), 'page');
    assert.equal(await nav().getByRole('link', { name: 'Store Orders', exact: true }).count(), 0);
    await page.getByText('Historical whole-product correction', { exact: true }).waitFor();
    await page.getByText(/Reconciliation required: this count conflicts/).waitFor();
    assert.equal(await page.getByRole('button', { name: /^Approve/ }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Reject', exact: true }).count(), 0);
    await page.getByLabel('Correction status', { exact: true }).selectOption('rejected');
    assert.equal(await page.locator('article').count(), 1);
    await page.getByText(/Please recount/).waitFor();
    await page.getByLabel('Correction status', { exact: true }).selectOption('');
    await page.getByLabel('Search correction requests').fill('B-000025');
    assert.equal(await page.locator('article').count(), 1);
    await page.evaluate(() => { window.inventoryUiNavigationStamp = 'same-document'; });
    const stockReadCount = calls.filter((c) => c.path === '/api/inventory/stock-adjustments').length;
    await additionButton().click(); await pressed(additionButton());
    await page.getByText('Description: QA delivery pending', { exact: true }).waitFor();
    await page.getByText('Description: QA delivery approved', { exact: true }).waitFor();
    await page.getByText('Description: QA delivery rejected', { exact: true }).waitFor();
    const target = new URL(page.url());
    assert.equal(target.searchParams.get('section'), 'addition'); assert.equal(target.searchParams.get('context'), 'qa');
    for (const key of ['page', 'search', 'status']) assert.equal(target.searchParams.has(key), false);
    assert.equal(await page.evaluate(() => window.inventoryUiNavigationStamp), 'same-document');
    assert.equal(calls.filter((c) => c.path === '/api/inventory/stock-adjustments').length, stockReadCount, 'Section switch reuses loaded requests');
    await page.goBack(); await pressed(correctionButton());
    assert.equal(await page.getByLabel('Search correction requests').inputValue(), '');
    await page.goForward(); await pressed(additionButton());
    await correctionButton().click(); await pressed(correctionButton());
    assert.equal(await page.getByLabel('Search correction requests').inputValue(), '');
    assert.equal(await page.locator('article').count(), 5);
    await screenshot('stock-correction');
    await page.goBack(); await pressed(additionButton());
    await page.reload(); await pressed(additionButton());
    await page.goBack(); await pressed(correctionButton());
    assert.equal(await page.getByLabel('Search correction requests').inputValue(), '');
    await page.goto(origin + '/inventory/verifications?section=policies&context=invalid');
    await pressed(correctionButton());
    assert.equal(await page.getByRole('button', { name: /Save product policy/ }).count(), 0);
    await page.goto(origin + '/inventory/verifications'); await pressed(correctionButton());
    await page.goto(origin + '/inventory/dashboard');
    await page.getByRole('heading', { name: 'Pending Tasks', exact: true }).waitFor();
    assert.equal(await page.locator('a[href="/inventory/orders"]').count(), 0);
    assert.equal(await page.getByRole('link', { name: /Active orders/ }).count(), 0);
    await page.getByRole('link', { name: 'View requests', exact: true }).click();
    await pressed(correctionButton()); assert.equal(new URL(page.url()).searchParams.get('section'), 'correction');
    await page.goto(origin + '/inventory/notifications');
    await page.getByRole('heading', { name: 'Notification', exact: true }).waitFor();
    await openWorkerMenu();
    const notification = nav().getByRole('link', { name: 'Notification', exact: true });
    assert.equal(await notification.getAttribute('aria-current'), 'page');
    assert.equal(await notification.locator('svg.lucide-bell').count(), 1);
    assert.equal(await notification.evaluate((e) => e.nextElementSibling?.textContent), 'Profile');
    assert.equal(await nav().getByRole('link', { name: 'Supervisor Notification', exact: true }).count(), 0);
    assert.equal(await nav().getByRole('link', { name: 'Activity Log', exact: true }).count(), 1);
    assert.equal(await nav().getByRole('link', { name: /Reports/ }).count(), 0);
    await screenshot('notification-menu');
    if (width < 1024) {
      await nav().getByRole('link', { name: 'Stock Verification Requests', exact: true }).click();
      await page.locator('button.fixed[aria-label="Close navigation menu"]').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.querySelector('nav[aria-label="Inventory navigation"]').closest('aside').getBoundingClientRect().right <= 1);
      await page.getByRole('heading', { name: 'Stock Request', exact: true }).waitFor();
    }
    assert.equal(await page.locator('body').evaluate((e) => e.scrollWidth <= innerWidth), true);
    // Shared defaults remain usable, including the existing bookmarked Worker order route.
    await page.goto(origin + '/inventory/low-stock'); await page.getByRole('heading', { name: 'Low Stock Monitoring', exact: true }).waitFor();
    assert.equal(await page.getByRole('group', { name: 'Stock request sections' }).count(), 0);
    await page.goto(origin + '/inventory/activity'); await page.getByRole('heading', { name: /Availability changes/ }).waitFor();
    await page.goto(origin + '/inventory/orders'); await page.getByRole('heading', { name: 'Store Orders', exact: true }).waitFor();
    // The Supervisor retains the complete order/preparation UI and existing stock tabs.
    role = 'supervisor'; await page.goto(origin + '/supervisor/orders');
    await page.getByRole('button', { name: 'Assign worker', exact: true }).waitFor();
    const accountLinks = page.locator('aside a').filter({ hasText: /^\s*(Notification|Profile|Logout)\s*$/ });
    assert.deepEqual(await accountLinks.allTextContents().then((v) => v.map((t) => t.trim())), ['Notification', 'Profile', 'Logout']);
    await page.getByLabel('Assign an Available worker').selectOption('5');
    await page.getByRole('button', { name: 'Assign worker', exact: true }).click();
    await page.getByRole('button', { name: 'Start preparing', exact: true }).click();
    await page.getByLabel('Prepared units for Water').fill('2');
    await page.getByRole('button', { name: 'Save item checklist', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm preparation complete and free worker', exact: true }).click();
    await page.getByRole('button', { name: 'Mark ready for pickup', exact: true }).click();
    await page.getByRole('heading', { name: 'Verify pickup credential and claimant', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Confirm cash payment', exact: true }).waitFor();
    await screenshot('supervisor-preparation');
    await page.goto(origin + '/supervisor/stock-approvals?section=addition');
    await page.getByRole('heading', { name: 'Correction requests and decisions' }).waitFor();
    assert.equal(await page.getByRole('group', { name: 'Stock request sections' }).count(), 0);
    await page.getByRole('button', { name: 'Stock additions (1 pending)', exact: true }).click();
    await page.getByRole('button', { name: 'Approve addition of 100 bottles', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    await context.close(); console.log(`PASS: ${width}px Worker request URL/Back/refresh, navigation/bell/drawer, tracker audit and Supervisor preparation/pickup UI.`);
  }
} finally { await browser?.close(); await server.close(); }
