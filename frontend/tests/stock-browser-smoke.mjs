// Real Chromium responsive checks with isolated, mocked HTTP data; never writes the working database.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const output = fileURLToPath(new URL('../../tmp/receiving-browser/', import.meta.url));
await mkdir(output, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
const origin = server.resolvedUrls.local[0].replace(/\/$/, '');
let browser;
const store = { store_id: 1, store_name: 'QA Store', address: 'QA only', status: 'active' };
const coke = { store_id: 1, product_id: 1, store_inventory_id: 1, product_name: 'Coke', size: '1.5 L', size_amount: '1.5000', size_unit: 'L', selling_unit: 'bottle', sku: 'GE-S1-QACOKE', category: 'Drinks', selling_price: '25.00', hard_stock_qty: 150, soft_stock_qty: 0, available_stock: 150, low_stock_threshold: 20, max_per_order: 50, nearest_expiry: '2027-12-31', status: 'active', batches: [{ id: 1, reference: 'GE-B-QA-FIRST', quantity_received: 100, remaining_quantity: 100, received_date: '2026-11-15', expiry_date: '2027-12-31', status: 'active', description: 'Delivery from supplier.' }, { id: 2, reference: 'GE-B-QA-LATER', quantity_received: 50, remaining_quantity: 50, received_date: '2026-11-16', expiry_date: '2028-12-31', status: 'active', description: 'Later delivery.' }] };
const water = { ...coke, product_id: 2, store_inventory_id: 2, product_name: 'Nature Spring', sku: 'GE-S1-QAWATER', size: '500 mL', size_amount: '500.0000', size_unit: 'mL', hard_stock_qty: 100, available_stock: 100, low_stock_threshold: null, nearest_expiry: '2028-12-31', batches: [] };
const receipt = { id: 1, store_inventory_id: 1, product_name: 'Coke', sku: coke.sku, size: coke.size, selling_unit: 'bottle', quantity: 100, received_date: '2026-11-16', expiry_date: '2027-12-31', description: 'Delivery from supplier.', requested_by_user_id: 3, created_at: '2026-11-16T01:00:00Z', status: 'pending' };
const failures = [];
try {
  browser = await chromium.launch({ headless: true, channel: process.env.QA_BROWSER_CHANNEL || 'msedge' });
  for (const width of [1440, 390, 320]) {
    let role = 'inventory_worker', products = [coke, water], receipts = [receipt], loseResponse = false;
    const calls = [];
    const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'America/New_York' });
    await context.addCookies([{ name: 'XSRF-TOKEN', value: 'qa-token', url: origin }]);
    await context.route('http://localhost:8000/**', async (route) => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method();
      const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Accept, Content-Type, X-XSRF-TOKEN', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS' };
      const respond = (data, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(data) });
      if (method === 'OPTIONS') return respond({});
      const body = request.postDataJSON(); calls.push({ path, method, body });
      if (path === '/sanctum/csrf-cookie') return respond({});
      if (path === '/api/user') return respond({ id: 3, role: { slug: role }, profile: { first_name: 'QA', last_name: 'Staff' } });
      if (path === '/api/inventory/items' && method === 'GET') return respond({ store, inventory: products });
      if (path === '/api/inventory/items' && method === 'POST') {
        assert.equal(body.sku, undefined);
        const product = { ...coke, ...body, store_inventory_id: 3, product_id: 3, sku: 'GE-S1-QANEW', size: body.size_amount+' '+body.size_unit, hard_stock_qty: 0, available_stock: 0, batches: [] };
        products = [...products, product]; return respond({ message: 'Product added to your store.', inventory: product }, 201);
      }
      if (/\/stock-receipts$/.test(path) && method === 'POST') {
        if (loseResponse) { loseResponse = false; return route.abort('failed'); }
        await new Promise((resolve) => setTimeout(resolve, 150));
        return respond({ message: 'Stock addition submitted for Supervisor approval. Stock is unchanged.' }, 201);
      }
      if (path === '/api/inventory/stock-receipts') return respond({ store, receipts });
      if (path === '/api/inventory/stock-adjustments') return respond({ store, adjustments: [] });
      if (path === '/api/inventory/low-stock-reports') return respond({ store, reports: [] });
      if (path === '/api/inventory/availability-history') return respond({ store, history: [] });
      if (path.endsWith('/policy')) return respond({ message: 'Product policy saved.' });
      if (path.endsWith('/decision')) { receipts = [{ ...receipt, status: body.decision }]; return respond({ message: 'Stock addition '+body.decision+'.' }); }
      failures.push('Unexpected API: '+method+' '+path); return respond({ message: 'Unexpected QA request' }, 500);
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => failures.push(error.message));
    const screenshot = (name) => page.screenshot({ path: output+`/${width}-${name}.png` });
    async function readableDialog() {
      const box = await page.getByRole('dialog').boundingBox();
      assert.ok(box.x >= 0 && box.x+box.width <= width+1, 'Dialog stays within viewport');
      assert.equal(await page.locator('body').evaluate((body) => body.scrollWidth <= window.innerWidth), true, 'Page has no horizontal overflow');
    }
    await page.goto(origin+'/inventory/products');
    await page.getByRole('button', { name: '+ Add New Product', exact: true }).click();
    await page.getByLabel('Product name').fill('Rice QA');
    assert.equal(await page.getByLabel('SKU', { exact: true }).inputValue(), 'Generated automatically');
    assert.equal(await page.getByLabel('SKU', { exact: true }).getAttribute('readonly'), '');
    for (const unit of ['mg', 'g', 'kg', 'mL', 'L']) await page.getByLabel('Unit of Measure').selectOption(unit);
    await page.getByLabel('Size amount').fill('500');
    await page.getByLabel('Unit of Measure').selectOption('g');
    await page.getByLabel('Sold as').selectOption('pack');
    await page.getByLabel('Category', { exact: true }).fill('Staples');
    await page.getByLabel('Selling price (PHP)').fill('30.00');
    await readableDialog(); await screenshot('product');
    await page.getByRole('button', { name: 'Add Product', exact: true }).click();
    await page.getByRole('button', { name: 'Edit Rice QA 500 g', exact: true }).click();
    assert.equal(await page.getByLabel('SKU', { exact: true }).inputValue(), 'GE-S1-QANEW');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: '+ Add Stock', exact: true }).count(), 0, 'Products has no receiving action');
    await page.goto(origin+'/inventory/stock');
    await page.getByRole('button', { name: '+ Add Stock', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '+ Add Stock', exact: true }).count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Export', exact: true }).count(), 0);
    assert.equal(await page.getByRole('region', { name: 'Stock filters' }).getByRole('button', { name: '+ Add Stock', exact: true }).count(), 1, 'Receiving action is in the filter toolbar');
    assert.equal(await page.getByRole('columnheader', { name: 'Date Received', exact: true }).count(), 1);
    assert.equal(await page.getByRole('columnheader', { name: 'Expiry', exact: true }).count(), 1);
    const cokeRow = page.locator('table').first().getByRole('row').filter({ hasText: 'Coke' });
    assert.equal((await cokeRow.getByRole('cell').nth(4).textContent()).trim(), '2026-11-15', 'Receipt date matches the displayed expiry batch');
    await page.getByRole('button', { name: '+ Add Stock', exact: true }).click();
    await page.getByLabel('Product', { exact: true }).selectOption('1');
    await page.getByLabel('Quantity to Add (bottles)').fill('100');
    const receiptDate = await page.getByLabel('Date Received', { exact: true }).inputValue();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    assert.equal(receiptDate, today);
    await page.getByLabel('Description', { exact: true }).fill('Delivery from supplier.');
    assert.equal(await page.getByLabel(/Expiry Date/).inputValue(), '');
    await readableDialog(); await screenshot('receipt');
    await page.getByRole('button', { name: 'Submit for Approval', exact: true }).dblclick();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    const submissions = calls.filter((call) => call.method === 'POST' && call.path.endsWith('/stock-receipts'));
    assert.equal(submissions.length, 1, 'Double-click submits once');
    assert.equal(submissions[0].body.quantity, 100); assert.equal(submissions[0].body.expiry_date, null);
    await page.getByRole('button', { name: '+ Add Stock', exact: true }).click();
    await page.getByLabel('Product', { exact: true }).selectOption('1');
    await page.getByLabel('Quantity to Add (bottles)').fill('9');
    await page.getByLabel('Description', { exact: true }).fill('Retry this exact delivery.');
    loseResponse = true;
    await page.getByRole('button', { name: 'Submit for Approval', exact: true }).click();
    await page.getByText('Submission outcome is uncertain.', { exact: false }).waitFor();
    assert.equal(await page.getByLabel('Quantity to Add (bottles)').isDisabled(), true);
    await page.getByRole('button', { name: 'Submit for Approval', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    const retries = calls.filter((call) => call.method === 'POST' && call.path.endsWith('/stock-receipts'));
    assert.equal(retries.length, 3);
    assert.deepEqual(retries[1].body, retries[2].body, 'Uncertain retry preserves operation identity and payload');
    await page.getByRole('button', { name: 'View Details', exact: true }).first().click();
    await page.getByText('Receipt details', { exact: true }).first().click();
    await readableDialog(); await screenshot('details');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    assert.equal(await page.getByRole('columnheader').count(), 8);
    await screenshot('table');
    role = 'supervisor';
    await page.goto(origin+'/supervisor/inventory');
    await page.getByRole('button', { name: 'View Details', exact: true }).first().click();
    await page.getByLabel('Re-order Level (bottles)').fill('0');
    await page.getByRole('button', { name: 'Save product policy', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    const policy = calls.find((call) => call.path.endsWith('/policy'));
    assert.deepEqual(policy.body, { max_per_order: 50, low_stock_threshold: 0 });
    await page.goto(origin+'/supervisor/stock-approvals');
    await page.getByRole('button', { name: 'Stock additions (1 pending)', exact: true }).click();
    await page.getByRole('button', { name: 'Approve addition of 100 bottles', exact: true }).waitFor();
    await screenshot('approval');
    await page.getByRole('button', { name: 'Approve addition of 100 bottles', exact: true }).click();
    await page.getByRole('button', { name: 'Stock additions (0 pending)', exact: true }).waitFor();
    await context.close();
    console.log(`PASS ${width}px: product units/SKU, receiving/double-click/retry identity, batch details, table, Supervisor policy and approval.`);
  }
  assert.deepEqual(failures, []);
} finally { await browser?.close(); await server.close(); }
