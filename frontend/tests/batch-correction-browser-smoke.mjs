// Responsive real-browser QA against mocked HTTP. No working database is used.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const output = fileURLToPath(new URL('../../tmp/batch-correction-browser/', import.meta.url));
await mkdir(output, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
const origin = server.resolvedUrls.local[0].replace(/\/$/, '');
const store = { store_id: 1, store_name: 'QA Store', address: 'Isolated HTTP fixtures', status: 'active' };
const products = [{ product_id: 1, product_name: 'Coke', sku: 'COKE-QA' }, { product_id: 2, product_name: 'Water', sku: 'WATER-QA' }];
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: process.env.QA_BROWSER_CHANNEL || 'msedge' });
  for (const width of [1440, 390, 320]) {
    const calls = [], failures = [];
    let failNext = false, loseNext = false, gate = null, role = 'inventory_worker';
    const batches = Array.from({ length: 26 }, (_, i) => ({ ...products[i >= 20 ? 1 : 0], id: i + 1,
      store_inventory_id: i >= 20 ? 2 : 1, batch_no: 'B-' + String(i + 1).padStart(6, '0'), size: '1.5 L', selling_unit: 'bottle',
      remaining_quantity: i === 25 ? 0 : 50, allocated_quantity: 2, received_date: i === 24 ? null : '2026-11-10',
      expiry_date: i === 24 ? null : '2027-01-01', stock_condition: i === 23 ? 'expired' : i >= 24 ? 'on_hold' : 'active', stock_version: 2, pending_adjustment_id: null }));
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addCookies([{ name: 'XSRF-TOKEN', value: 'qa-token', url: origin }]);
    await context.route('http://localhost:8000/**', async (route) => {
      const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method();
      const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Accept, Content-Type, X-XSRF-TOKEN', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS' };
      const respond = (data, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(data) });
      if (method === 'OPTIONS') return respond({});
      calls.push({ path, method, query: url.search, body: req.postDataJSON() });
      if (path === '/api/user') return respond({ id: 3, role: { slug: role }, profile: { first_name: 'QA', last_name: 'Staff' } });
      if (path === '/sanctum/csrf-cookie') return respond({});
      if (path === '/api/inventory/correction-batches') {
        if (failNext) { failNext = false; return respond({ message: 'QA read failed' }, 503); }
        const search = (url.searchParams.get('search') || '').toLowerCase();
        const product = url.searchParams.get('product'), condition = url.searchParams.get('condition');
        const rows = batches.filter((b) => (b.remaining_quantity > 0 || url.searchParams.get('include_empty') === '1')
          && (!product || String(b.product_id) === product) && (!condition || (condition === 'empty' ? b.remaining_quantity === 0 : b.stock_condition === condition))
          && [b.product_name, b.sku, b.batch_no].join(' ').toLowerCase().includes(search));
        const last = Math.max(1, Math.ceil(rows.length / 10)), page = Math.min(Number(url.searchParams.get('page')), last);
        const result = { store, products, batches: rows.slice((page - 1) * 10, page * 10), pagination: {
          current_page: page, last_page: last, per_page: 10, total: rows.length, from: rows.length ? (page - 1) * 10 + 1 : null, to: rows.length ? Math.min(page * 10, rows.length) : null } };
        if (gate) { const wait = gate; gate = null; wait.arrived(); await wait.promise; }
        return respond(result);
      }
      if (path.endsWith('/stock-adjustments') && method === 'POST') {
        const body = req.postDataJSON();
        assert.equal(body.requested_hard_stock_qty, undefined);
        assert.equal(body.store_id, undefined);
        if (loseNext) { loseNext = false; return route.abort('failed'); }
        batches.find((b) => b.id === body.inventory_batch_id).pending_adjustment_id = 71;
        return respond({ message: 'Batch count submitted for Supervisor approval. Stock is unchanged.', adjustment: { id: 71 } }, 201);
      }
      if (path === '/api/inventory/items') return respond({ store, inventory: [] });
      if (path === '/api/inventory/stock-receipts') return respond({ store, receipts: [] });
      if (path === '/api/inventory/low-stock-reports') return respond({ store, reports: [] });
      if (path === '/api/inventory/availability-history') return respond({ store, history: [] });
      if (path === '/api/inventory/stock-adjustments') return respond({ store, adjustments: [{ id: 71, inventory_batch_id: 24, batch_no: 'B-000024',
        product_name: 'Water', sku: 'WATER-QA', observed_remaining_quantity: 50, requested_remaining_quantity: 40, quantity_change: -10,
        current_remaining_quantity: 50, current_allocated_quantity: 2, observed_allocated_quantity: 2, status: 'pending',
        received_date: '2026-11-10', expiry_date: '2027-01-01', stock_condition: 'expired', reason: 'Recount confirmed', requested_by_name: 'QA Worker' },
      { id: 1, product_name: 'Coke', sku: 'COKE-QA', is_legacy: true, observed_hard_stock_qty: 100, requested_hard_stock_qty: 95, status: 'pending', reason: 'Legacy' }] });
      failures.push(method + ' ' + path); return respond({ message: 'Unexpected fixture request' }, 500);
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => failures.push(error.message));
    const table = () => page.getByRole('table');
    const search = page.getByRole('searchbox', { name: 'Search batches' });
    const ready = (text) => page.getByText(text, { exact: true }).waitFor();
    const screenshot = (name) => page.screenshot({ path: output + `/${width}-${name}.png` });
    await page.goto(origin + '/inventory/stock-update');
    await ready('Showing 1–10 of 25 batches · Page 1 of 3');
    assert.equal(await table().locator('tbody tr').count(), 10);
    assert.equal(await page.getByRole('button', { name: /Stock additions/ }).count(), 0);
    assert.equal(calls.some((c) => c.path === '/api/inventory/items'), false, 'No all-inventory batch preload');
    assert.equal(await page.getByRole('link', { name: 'My requests', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await ready('Showing 11–20 of 25 batches · Page 2 of 3');
    for (const value of ['Water', 'WATER-QA', 'B-000024']) {
      await search.fill(value);
      await ready(value === 'B-000024' ? 'Showing 1–1 of 1 batches · Page 1 of 1' : 'Showing 1–5 of 5 batches · Page 1 of 1');
    }
    await page.getByRole('button', { name: 'Clear Filters' }).click();
    await page.getByLabel('Product filter').selectOption('2');
    await ready('Showing 1–5 of 5 batches · Page 1 of 1');
    await page.getByLabel('Stock Condition', { exact: true }).selectOption('on_hold');
    await ready('Showing 1–1 of 1 batches · Page 1 of 1');
    await page.getByLabel('Include empty batches').check();
    await ready('Showing 1–2 of 2 batches · Page 1 of 1');
    await page.getByLabel('Stock Condition', { exact: true }).selectOption('empty');
    await ready('Showing 1–1 of 1 batches · Page 1 of 1');
    await page.getByRole('button', { name: 'Update Count B-000026', exact: true }).click();
    await page.getByLabel('Actual Remaining Count').fill('5');
    await page.getByLabel('Reason for Correction').fill('Found remaining units.');
    assert.equal(await page.getByRole('dialog').getByRole('combobox').count(), 0);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'Update Count B-000026' }).evaluate((e) => e === document.activeElement), true);
    await page.getByRole('button', { name: 'Update Count B-000026' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Update Count B-000026' }).evaluate((e) => e === document.activeElement), true);
    await page.getByRole('button', { name: 'Update Count B-000026' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Clear Filters' }).click();
    await search.fill('B-000024');
    await ready('Showing 1–1 of 1 batches · Page 1 of 1');
    await page.getByRole('button', { name: 'Update Count B-000024' }).click();
    const dialog = page.getByRole('dialog'), close = dialog.getByRole('button', { name: 'Close', exact: true });
    assert.equal(await close.evaluate((e) => e === document.activeElement), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await dialog.getByRole('button', { name: 'Cancel', exact: true }).evaluate((e) => e === document.activeElement), true, 'Focus wraps past disabled submit');
    await page.keyboard.press('Tab');
    assert.equal(await close.evaluate((e) => e === document.activeElement), true);
    await page.getByLabel('Reason for Correction').fill('Recount confirmed');
    for (const count of ['50', '-1', '1.5']) {
      await page.getByLabel('Actual Remaining Count').fill(count);
      assert.equal(await dialog.getByRole('button', { name: 'Submit for Approval' }).isDisabled(), true);
    }
    await page.getByLabel('Actual Remaining Count').fill('0');
    assert.equal(await dialog.getByRole('button', { name: 'Submit for Approval' }).isEnabled(), true);
    await dialog.getByText(/Reconciliation required/).waitFor();
    await page.getByLabel('Actual Remaining Count').fill('40');
    await dialog.getByText('Recorded: 50 bottles; Actual: 40 bottles; Change: -10 bottles.', { exact: true }).waitFor();
    const box = await dialog.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width + 1 && box.height <= 811);
    assert.equal(await page.locator('body').evaluate((e) => e.scrollWidth <= innerWidth), true);
    await screenshot('modal');
    loseNext = true;
    await dialog.getByRole('button', { name: 'Submit for Approval' }).click();
    await dialog.getByRole('button', { name: 'Retry Submission' }).waitFor();
    assert.equal(await page.getByLabel('Actual Remaining Count').isDisabled(), true);
    await dialog.getByRole('button', { name: 'Retry Submission' }).dblclick();
    await ready('Correction submitted. Track it in Stock Request.');
    await page.getByText('Correction pending', { exact: true }).waitFor();
    assert.equal(await search.inputValue(), 'B-000024');
    assert.equal(await page.getByRole('button', { name: 'Update Count B-000024' }).isDisabled(), true);
    const writes = calls.filter((c) => c.method === 'POST' && c.path.endsWith('/stock-adjustments'));
    assert.equal(writes.length, 2);
    assert.deepEqual(writes[0].body, writes[1].body);
    assert.equal(writes[0].body.inventory_batch_id, 24);
    assert.equal(writes[0].body.requested_remaining_quantity, 40);
    await page.getByRole('button', { name: 'Clear Filters' }).click();
    await ready('Showing 1–10 of 25 batches · Page 1 of 3');
    await screenshot('table');
    let arrive, release;
    gate = { arrived: () => arrive(), promise: new Promise((resolve) => { release = resolve; }) };
    const arrived = new Promise((resolve) => { arrive = resolve; });
    await search.fill('COKE-QA'); await arrived;
    await search.fill('B-000025');
    await ready('Showing 1–1 of 1 batches · Page 1 of 1');
    release();
    await page.getByRole('button', { name: 'Update Count B-000025' }).waitFor();
    failNext = true; await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByRole('alert').getByText('QA read failed').waitFor();
    await page.getByRole('button', { name: 'Retry batches' }).click();
    await ready('Showing 1–1 of 1 batches · Page 1 of 1');
    await search.fill('No match'); await page.getByText('No matching recorded batches.', { exact: true }).waitFor();
    await ready('Showing 0–0 of 0 batches · Page 1 of 1');
    await page.goto(origin + '/inventory/verifications?section=correction');
    await page.getByRole('heading', { name: 'Stock Request', exact: true }).waitFor();
    await page.getByText('Reason: Recount confirmed', { exact: true }).waitFor();
    await page.getByText('B-000024 · expired', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: /^Approve count/ }).count(), 0);
    // Supervisor reviews use the existing Corrections tab, retaining historical labeling.
    role = 'supervisor';
    await page.goto(origin + '/supervisor/stock-approvals');
    await page.getByRole('button', { name: /Corrections/ }).click();
    await page.getByText('B-000024 · expired', { exact: true }).waitFor();
    await page.getByText('Historical whole-product correction', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Approve count 95', exact: true }).isDisabled(), true);
    await screenshot('review');
    assert.deepEqual(failures, []);
    await context.close();
    console.log(`PASS: ${width}px batch table, server filters, modal validation/focus, retry, pending, stale reads, history review.`);
  }
} finally { await browser?.close(); await server.close(); }
