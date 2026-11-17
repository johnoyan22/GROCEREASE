// Responsive integration checks against mocked HTTP. No working database writes.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const output = fileURLToPath(new URL('../../tmp/categories-low-stock-browser/', import.meta.url));
await mkdir(output, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
const origin = server.resolvedUrls.local[0].replace(/\/$/, '');
const store = { store_id: 1, store_name: 'QA Store', address: 'QA only', status: 'active' };
const product = { store_id: 1, product_id: 7, store_inventory_id: 7, product_name: 'QA Rice', sku: 'QA-RICE', selling_unit: 'bag',
  hard_stock_qty: 10, soft_stock_qty: 2, available_stock: 8, low_stock_threshold: 10, shortfall: 0, category: 'Staples', category_id: 1,
  selling_price: '50.00', status: 'active', is_low_stock: true, stock_version: 3 };
function paginate(rows, url) {
  const last = Math.max(1, Math.ceil(rows.length / 10)), page = Math.min(Number(url.searchParams.get('page') || 1), last);
  return { rows: rows.slice((page - 1) * 10, page * 10), pagination: { current_page: page, last_page: last, total: rows.length, per_page: 10,
    from: rows.length ? (page - 1) * 10 + 1 : null, to: rows.length ? Math.min(page * 10, rows.length) : null } };
}
let browser;
try {
  browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL || 'msedge', headless: true });
  for (const width of [1440, 390, 320]) {
    let role = 'inventory_worker', read = false, optionsMode = 'active', failLow = false;
    let categories = [{ id: 1, name: 'Staples', status: 'active', can_delete: false }, ...Array.from({ length: 11 }, (_, i) => ({ id: i + 2, name: 'Category ' + String(i).padStart(2, '0'), status: i % 2 ? 'inactive' : 'active', can_delete: true }))];
    const errors = [], writes = [];
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addCookies([{ name: 'XSRF-TOKEN', value: 'qa', url: origin }]);
    await context.route(/\/(?:api|sanctum)\//, async (route) => {
      const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method();
      const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Accept, Content-Type, X-XSRF-TOKEN', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS' };
      const respond = (data, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(data) });
      if (method === 'OPTIONS') return respond({});
      if (method !== 'GET') writes.push({ method, path, body: req.postDataJSON() });
      if (path === '/api/user') return respond({ id: 3, role: { slug: role }, profile: { first_name: 'QA', last_name: 'Staff' } });
      if (path === '/sanctum/csrf-cookie') return respond({});
      if (path === '/api/staff/store') return respond({ store });
      if (path === '/api/dashboard/summary') return respond({ store, role, recent_adjustments: [] });
      if (path === '/api/inventory/items' && method === 'GET') return respond({ store, inventory: [{ ...product, category_status: optionsMode === 'empty' ? 'inactive' : 'active' }] });
      if (path === '/api/inventory/items' && method === 'POST') return respond({ message: 'Category was deactivated. Choose an active category.', errors: { category_id: ['Choose an active category from your store.'] } }, 422);
      if (path === '/api/inventory/items/7/batches') return respond({ store, store_inventory_id: 7, batches: [], pagination: { current_page: 1, last_page: 1, total: 0, per_page: 5 } });
      if (path === '/api/inventory/low-stock') {
        if (failLow) { failLow = false; return respond({ message: 'QA monitoring unavailable' }, 503); }
        const rows = [product].filter((p) => (p.product_name + p.sku).toLowerCase().includes((url.searchParams.get('search') || '').toLowerCase()));
        const result = paginate(rows, url); return respond({ store, inventory: result.rows, pagination: result.pagination });
      }
      if (path === '/api/staff/low-stock-notifications/4/read') { read = true; return respond({ message: 'Read' }); }
      if (path === '/api/staff/low-stock-notifications') {
        assert.ok(['0', '1'].includes(url.searchParams.get('unread')));
        const rows = read && url.searchParams.get('unread') === '1' ? [] : [{ id: 4, read_at: read ? '2026-11-17 01:00:00' : null,
          episode: { ...product, product_name: 'QA Rice', observed_physical_qty: 10, reorder_level: 10, started_at: '2026-11-17 00:00:00', closed_at: null },
          current: { selling_unit: 'bag', physical_quantity: 9, reorder_level: 10, is_low_stock: true }, link: (role === 'supervisor' ? '/supervisor/low-stock' : '/inventory/low-stock') + '?store=1&product=7' }];
        const result = paginate(rows, url); return respond({ store, notifications: result.rows, pagination: result.pagination });
      }
      if (path === '/api/staff/category-options') {
        if (optionsMode === 'error') return respond({ message: 'QA category options unavailable' }, 503);
        return respond({ store, categories: optionsMode === 'empty' ? [] : categories.filter((c) => c.status === 'active') });
      }
      if (path === '/api/staff/categories') {
        const rows = categories.filter((c) => c.name.toLowerCase().includes((url.searchParams.get('search') || '').toLowerCase()) && (!url.searchParams.get('status') || c.status === url.searchParams.get('status'))).sort((a, b) => a.name.localeCompare(b.name));
        const result = paginate(rows, url); return respond({ store, categories: result.rows, pagination: result.pagination });
      }
      if (path.startsWith('/api/supervisor/categories')) {
        const body = req.postDataJSON(), id = Number(path.split('/').at(-1));
        if (method === 'DELETE') { categories = categories.filter((c) => c.id !== id); return respond({ message: 'Unused category deleted.' }); }
        if (categories.some((c) => c.id !== id && c.name.toLowerCase() === body.name.toLowerCase())) return respond({ message: 'Duplicate', errors: { name: ['A category with this name already exists.'] } }, 422);
        if (method === 'POST') categories.push({ id: 99, ...body, can_delete: true });
        else categories = categories.map((c) => c.id === id ? { ...c, ...body } : c);
        return respond({ message: 'Category saved.' }, method === 'POST' ? 201 : 200);
      }
      errors.push(method + ' ' + path); return respond({ message: 'Unexpected QA request' }, 500);
    });
    const page = await context.newPage(); page.on('pageerror', (e) => errors.push(e.message));
    const screenshot = (name) => page.screenshot({ path: output + `/${width}-${name}.png` });
    const noOverflow = async () => assert.equal(await page.locator('body').evaluate((el) => el.scrollWidth <= innerWidth), true);
    await page.goto(origin + '/inventory/low-stock');
    await page.getByRole('cell', { name: '10 bags', exact: true }).first().waitFor();
    assert.equal(await page.getByRole('cell', { name: '0 bags', exact: true }).count(), 1);
    assert.equal(await page.getByRole('button', { name: /Stock additions|Report low stock|Send low-stock/ }).count(), 0);
    await page.getByRole('button', { name: 'View Details', exact: true }).click();
    await page.getByRole('dialog').waitFor(); await page.keyboard.press('Escape');
    await page.getByLabel('Search low-stock products').fill('absent');
    await page.getByText('No low-stock products.', { exact: true }).waitFor();
    await page.getByLabel('Search low-stock products').fill('QA Rice');
    await page.getByRole('cell', { name: '0 bags', exact: true }).waitFor();
    failLow = true; await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'QA monitoring unavailable' }).waitFor();
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.getByRole('cell', { name: '0 bags', exact: true }).waitFor(); await noOverflow(); await screenshot('monitor');
    await page.goto(origin + '/inventory/notifications');
    await page.getByText(/At alert: 10 bags physical/).waitFor(); await page.getByText(/Current physical: 9 bags/).waitFor();
    await page.getByRole('button', { name: 'Mark as read', exact: true }).click();
    await page.getByText('Read', { exact: true }).waitFor();
    await page.getByLabel('Unread only').check(); await page.getByText('No low-stock notifications.', { exact: true }).waitFor();
    await page.getByLabel('Unread only').uncheck(); await page.getByRole('link', { name: 'Open Low Stock Monitoring' }).click();
    await page.getByRole('cell', { name: '0 bags', exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('product'), '7'); assert.equal(new URL(page.url()).searchParams.get('store'), '1');
    role = 'supervisor'; await page.goto(origin + '/supervisor/categories');
    await page.getByRole('heading', { name: 'Category Management', exact: true }).waitFor();
    await page.getByRole('button', { name: '+ Add Category', exact: true }).waitFor();
    assert.equal(await page.locator('aside nav a').evaluateAll((links) => links.findIndex((a) => a.textContent === 'Category Management') - links.findIndex((a) => a.textContent === 'Store Products')), 1);
    await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.getByText(/Page 2 of 2/).waitFor();
    await page.getByLabel('Search categories').fill('Staples'); await page.getByRole('table').getByRole('paragraph').filter({ hasText: /^Staples$/ }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Delete Staples', exact: true }).count(), 0);
    await page.getByRole('button', { name: '+ Add Category', exact: true }).click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    assert.equal(await page.getByLabel('Category Name', { exact: true }).evaluate((el) => el === document.activeElement), true);
    await page.getByLabel('Category Name', { exact: true }).fill('Staples'); await dialog.getByRole('button', { name: 'Save Category' }).click();
    await dialog.getByRole('alert').filter({ hasText: 'already exists' }).waitFor();
    await page.getByLabel('Category Name', { exact: true }).fill('Fresh Produce'); await dialog.getByRole('button', { name: 'Save Category' }).click();
    await dialog.waitFor({ state: 'hidden' }); await page.getByLabel('Search categories').fill('Fresh Produce');
    await page.getByRole('cell', { name: 'Fresh Produce', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Edit Fresh Produce', exact: true }).click();
    await page.getByLabel('Category Name', { exact: true }).fill('Fresh Produce Updated');
    await screenshot('category-modal'); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.getByRole('button', { name: 'Edit Fresh Produce', exact: true }).evaluate((el) => el === document.activeElement), true);
    await page.getByRole('button', { name: 'Deactivate Fresh Produce', exact: true }).click();
    await page.getByRole('button', { name: 'Reactivate Fresh Produce', exact: true }).waitFor();
    await page.getByLabel('Category status filter').selectOption('active'); await page.getByText(/No matching categories/).waitFor();
    await page.getByLabel('Category status filter').selectOption('inactive');
    await page.getByRole('button', { name: 'Reactivate Fresh Produce', exact: true }).click();
    await page.getByText(/No matching categories/).waitFor(); await page.getByLabel('Category status filter').selectOption('');
    await page.getByRole('button', { name: 'Delete Fresh Produce', exact: true }).click();
    await dialog.getByRole('button', { name: 'Delete Category', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
    await page.getByText(/No matching categories/).waitFor(); await noOverflow(); await screenshot('categories');
    role = 'inventory_worker'; optionsMode = 'error'; await page.goto(origin + '/inventory/products');
    await page.getByRole('button', { name: '+ Add New Product', exact: true }).click();
    await page.getByRole('button', { name: 'Retry categories' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Add Product', exact: true }).isDisabled(), true);
    optionsMode = 'empty'; await page.getByRole('button', { name: 'Retry categories' }).click(); await page.getByText(/No active categories/).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Add Product', exact: true }).isDisabled(), true);
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' }); await page.getByRole('button', { name: 'Edit QA Rice', exact: true }).click();
    await page.getByLabel('Category', { exact: true }).getByRole('option', { name: /Inactive; current selection/ }).waitFor({ state: 'attached' });
    assert.equal(await page.getByRole('button', { name: 'Save Product', exact: true }).isEnabled(), true); await page.keyboard.press('Escape');
    optionsMode = 'active'; await page.getByRole('button', { name: '+ Add New Product', exact: true }).click();
    await page.getByLabel('Category', { exact: true }).selectOption('1'); await page.getByLabel('Product name').fill('New QA Rice');
    await page.getByLabel('Selling price (PHP)').fill('10.00'); await page.getByRole('button', { name: 'Add Product', exact: true }).click();
    await page.getByText('Choose an active category from your store.', { exact: true }).waitFor();
    const bounds = await dialog.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
    await page.keyboard.press('Tab'); assert.equal(await dialog.evaluate((el) => el.contains(document.activeElement)), true);
    await noOverflow(); await screenshot('product-category');
    assert.ok(writes.some((w) => w.body?.category_id === '1' && w.body?.category === undefined));
    assert.deepEqual(errors, []); console.log(`PASS: ${width}px automatic monitoring, notification snapshot/read/link, category CRUD/paging/filter/focus, dropdown errors/empty/inactive/stale.`);
    await context.close();
  }
} finally { await browser?.close(); await server.close(); }
