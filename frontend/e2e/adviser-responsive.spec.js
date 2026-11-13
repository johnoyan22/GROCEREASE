import { test, expect } from '@playwright/test';
test.describe.configure({ mode: 'parallel' });

// Browser fixtures exercise real rendered components. Backend persistence, role/store
// permissions and provider HTTP fakes are separately covered by Laravel tests.
const store = { store_id: 1, store_name: 'QA Store', address: 'QA address', status: 'active' };
const timestamp = new Date().toISOString();
const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + 86400000));
const product = { store_inventory_id: 7, store_id: 1, product_id: 3, product_name: 'QA Rice', name: 'QA Rice', sku: 'QA-RICE', barcode: '000123', category: 'Staples', category_id: 1, size: '1 kg', selling_unit: 'pack', image_url: null, selling_price: '67.25', hard_stock_qty: 25, soft_stock_qty: 5, available_stock: 20, max_per_order: 5, low_stock_threshold: 4, stock_version: 1, status: 'active', updated_at: timestamp };
const order = { order_id: 9, order_reference: 'GE-9', store_id: 1, store_name: 'QA Store', store_address: 'QA address', shopper_name: 'Maria Santos', created_at: timestamp, updated_at: timestamp, status: 'ready_for_pickup', claim_status: 'claimable', payment_status: 'unpaid', payment_method: 'cash_on_pickup', reservation_status: 'active', currency: 'PHP', subtotal_centavos: 13450, service_fee_centavos: 0, total_centavos: 13450, pickup_window_start_at: tomorrow + 'T02:00:00Z', pickup_window_end_at: tomorrow + 'T03:00:00Z', claim_expires_at: new Date(Date.now() + 172800000).toISOString(), pickup_schedule_review_required: false, assignments: [], history: [], pickup: { verified_at: null, handed_over_at: null }, refund_status: 'not_required', items: [{ order_item_id: 1, store_inventory_id: 7, product_name: 'QA Rice', sku: 'QA-RICE', size: '1 kg', selling_unit: 'pack', quantity: 2, prepared_qty: 2, unit_price_centavos: 6725, line_total_centavos: 13450 }] };
async function fixtures(page, role = 'shopper') {
  const issues = []; page.on('pageerror', error => issues.push(error.message));
  await page.context().addCookies([{ name: 'XSRF-TOKEN', value: 'qa-token', domain: 'localhost', path: '/' }]);
  await page.route('http://localhost:8000/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const headers = { 'Access-Control-Allow-Origin': 'http://localhost:5187', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Accept, Content-Type, X-XSRF-TOKEN', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS' };
    const reply = (data, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(data) });
    if (request.method() === 'OPTIONS' || path.endsWith('/csrf-cookie')) return route.fulfill({ status: 204, headers });
    if (path === '/api/user') return role === 'guest' ? reply({ message: 'Unauthenticated.' }, 401) : reply({ id: 5, role: { slug: role, name: role === 'inventory_worker' ? 'Inventory Worker' : role }, email: 'qa@example.test', email_verified_at: timestamp, account_status: 'active', profile: { first_name: 'Maria', last_name: 'Santos', phone_number: '09123456789', address: 'QA address' } });
    if (path.endsWith('/dashboard/summary')) return reply({ role, server_time: timestamp, store, active_orders: 1, recent_active_orders: [{ ...order, item_quantity: 2 }], unread_notifications: 1, waiting_orders: 0, preparing_orders: 0, ready_orders: 1, schedule_reviews: 0, busy_workers: 0, available_workers: 2, products_managed: 1, inventory_records: 1, physical_units: 25, reserved_units: 5, available_units: 20, low_stock_products: 0, stock_statuses: { in_stock: 1, low_stock: 0, out_of_stock: 0, inactive: 0 }, pending_stock_approvals: 0, stock_updates_today: 0, recent_adjustments: [], recent_reports: [], recent_activity: [], total_users: 4, cop_restricted_accounts: 0, todays_sales_centavos: 13450, low_stock_records: [], restricted_accounts: [], roles: [{ name: 'Shopper', slug: 'shopper', user_count: 1 }, { name: 'Supervisor', slug: 'supervisor', user_count: 1 }, { name: 'Inventory Worker', slug: 'inventory_worker', user_count: 1 }, { name: 'Admin', slug: 'admin', user_count: 1 }] });
    if (path === '/api/shopper/stores' || path === '/api/admin/stores') return reply({ stores: [store] });
    if (path === '/api/staff/store') return reply({ store });
    if (path.endsWith('/products')) return reply({ store, products: [product] });
    if (path === '/api/inventory/items') return reply({ store, inventory: [product] });
    if (path === '/api/inventory/categories') return reply({ store, categories: [{ id: 1, store_id: 1, name: 'Staples', active: true, products_count: 1 }] });
    if (path.endsWith('/price-history')) return reply({ history: [] });
    if (path === '/api/inventory/receiving') return reply({ store, requests: [], batches: [] });
    if (path === '/api/inventory/stock-alerts') return reply({ store, alerts: [{ id: 1, product_name: 'QA Rice', available_qty: 4, reorder_level: 4, created_at: timestamp, read_at: null, recovered_at: null }] });
    if (path === '/api/inventory/stock-adjustments') return reply({ store, adjustments: [] });
    if (path === '/api/inventory/low-stock-reports') return reply({ store, reports: [] });
    if (path === '/api/inventory/availability-history') return reply({ store, history: [] });
    if (path.endsWith('/workers')) return reply({ store, workers: [] });
    if (path === '/api/supervisor/staff') return reply({ store, assigned_staff: [], available_staff: [] });
    if (path.endsWith('/cop-status')) return reply({ cop: { allowed: true, strike_count: 0, permanently_disabled: false } });
    if (path.endsWith('/order-notifications')) return reply({ notifications: [{ id: 1, order_id: 9, message: 'Your QA order is ready for pickup. Complete claimant and payment checks at the supermarket.', created_at: timestamp, read_at: null }] });
    if (path === '/api/staff/orders' || path === '/api/shopper/orders') {
      if (request.method() === 'POST') return reply({ order: { ...order, status: 'waiting', claim_status: 'awaiting_preparation' } }, 201);
      return reply({ store, orders: [order], server_time: timestamp });
    }
    if (path.endsWith('/order-lookup')) return reply({ order, notice: 'Complete QR/PIN, claimant verification, payment and physical handover.' });
    if (path.endsWith('/pickup')) return reply({ credential: { pin: '12345678', qr_token: 'a'.repeat(64), expires_at: order.claim_expires_at } });
    if (path.endsWith('/payment-options')) return reply({ digital: { available: false, channels: [], reason: 'Authorized sandbox setup is pending.' } });
    if (path.endsWith('/pickup-hours')) return reply({ hours: { date: tomorrow, opens_at: '09:00', closes_at: '18:00', store_opens_at: '08:00', store_closes_at: '20:00', earliest_start_at: '09:00' } });
    if (path === '/api/shopper/checkout/quote') return reply({ quote: { ...order, store, items: order.items, cop_claim_deadline_at: tomorrow + 'T12:00:00Z' }, quote_token: 'qa-review', expires_at: new Date(Date.now() + 600000).toISOString() });
    if (path.endsWith('/shopper/selected-store')) return reply({ store });
    if (path.includes('/ai-recommendations')) return reply({ store_id: 1, data: [{ ...product, reason: 'Actual QA catalog fixture' }], meta: { enabled: true, source: 'available' } });
    if (path.endsWith('/ai-recommendation/settings')) return reply({ store, data: { enabled: true, max_items: 5, ranking_basis: 'hybrid', include_alternatives: true, included_categories: [], excluded_categories: [], store_id: 1 }, categories: ['Staples'], audit: [], dataset_rule: 'Store-scoped completed purchases.' });
    if (path.endsWith('/pickup-settings')) return reply({ store, store_id: 1, operating_hours: Object.fromEntries([1,2,3,4,5,6,7].map(day => [day, { opens_at: '08:00', closes_at: '20:00' }])), pickup_service_hours: Object.fromEntries([1,2,3,4,5,6,7].map(day => [day, { opens_at: '09:00', closes_at: '18:00' }])), paid_order_holding_hours: null, history: [], closures: [], audit: [], exceptions: [], affected_orders: [], schedule_history: [] });
    if (path.endsWith('/transactions')) return reply({ store: role === 'supervisor' ? store : null, transactions: [] });
    if (path.endsWith('/invoice-settings')) return reply({ settings: null, official_issuance_enabled: false });
    if (path.endsWith('/cop-strikes')) return reply({ strikes: [], accounts: [] });
    if (path.endsWith('/read')) return reply({ message: 'Acknowledged.' });
    return reply({ message: 'QA fixture endpoint unavailable: ' + path }, 503);
  });
  return issues;
}
async function noOverflow(page, label) {
  await page.waitForTimeout(80);
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, root: document.documentElement.scrollWidth, main: [...document.querySelectorAll('main')].map(el => ({ client: el.clientWidth, scroll: el.scrollWidth })) }));
  expect(dimensions.root, label + ': root overflow').toBeLessThanOrEqual(dimensions.viewport + 1);
  for (const main of dimensions.main) expect(main.scroll, label + ': main overflow').toBeLessThanOrEqual(main.client + 1);
}
async function shopperTab(page, name) {
  const target = page.getByRole('button', { name, exact: true });
  if (!await target.isVisible()) { await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click(); await page.getByRole('dialog', { name: 'Navigation', exact: true }).getByRole('button', { name, exact: true }).click(); }
  else await target.click();
}
for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
  test('Shopper workflows at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: width >= 768 ? 900 : 844 }); const issues = await fixtures(page);
    await page.goto('/shopper/dashboard'); await expect(page.getByRole('heading', { name: 'Welcome, Shopper!' })).toBeVisible(); await noOverflow(page, 'Dashboard');
    await shopperTab(page, 'Browse Products'); await page.getByRole('combobox', { name: 'Shop at' }).selectOption('1'); await expect(page.getByRole('heading', { name: 'QA Rice', exact: true })).toBeVisible(); await noOverflow(page, 'Browse');
    await page.getByRole('button', { name: 'Add to cart', exact: true }).click(); await page.getByRole('button', { name: 'View Cart', exact: true }).click(); await expect(page.getByRole('heading', { name: 'My Cart', exact: true })).toBeVisible(); await noOverflow(page, 'Cart');
    await page.getByRole('button', { name: 'Increase QA Rice quantity' }).click(); await expect(page.getByRole('spinbutton', { name: 'Cart quantity for QA Rice' })).toHaveValue('2');
    if ([375, 390, 1440].includes(width)) await page.screenshot({ path: '../tmp/browser-results/shopper-cart-' + width + '.png', fullPage: true });
    await page.getByRole('button', { name: 'Proceed to Checkout', exact: true }).click(); const dialog = page.getByRole('dialog', { name: 'Checkout', exact: true }); await expect(dialog).toBeVisible();
    await dialog.getByLabel('Pickup date').fill(tomorrow); await dialog.getByLabel('From (Philippine time)', { exact: true }).fill('10:00'); await dialog.getByLabel('Until (Philippine time)', { exact: true }).fill('11:00');
    await dialog.getByRole('button', { name: 'Review current prices and pickup schedule' }).click(); await expect(dialog.getByRole('button', { name: 'Confirm / Place Order' })).toBeEnabled(); await noOverflow(page, 'Checkout');
    if ([375,390].includes(width)) await page.screenshot({ path: '../tmp/browser-results/shopper-checkout-' + width + '.png' });
    await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
    await shopperTab(page, 'My Orders'); await expect(page.getByRole('heading', { name: /Order #9/ })).toBeVisible(); await page.getByRole('button', { name: 'Show QR / pickup PIN' }).click(); await expect(page.getByAltText('Pickup QR code for order 9')).toBeVisible(); await noOverflow(page, 'Orders and pickup QR');
    for (const name of ['Pick up Information','Notifications','My Profile','Account & Security',/^AI Recommendations/]) {
      await shopperTab(page, name); await noOverflow(page, name);
    }
    await shopperTab(page, 'My Profile'); await page.getByRole('button', { name: 'Edit Profile' }).click(); await noOverflow(page, 'Profile edit'); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(issues).toEqual([]);
  });
  test('Public and authentication at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); const issues = await fixtures(page, 'guest');
    await page.goto('/'); await expect(page.getByRole('heading', { name: /Fresh plans/ })).toBeVisible(); await noOverflow(page, 'Landing');
    await expect(page.getByRole('link', { name: 'Start Shopping' })).toHaveAttribute('href', '/login');
    if ([375,1440].includes(width)) await page.screenshot({ path: '../tmp/browser-results/landing-' + width + '.png', fullPage: true });
    await page.getByRole('link', { name: 'Start Shopping' }).click(); await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible(); await noOverflow(page, 'Login');
    await page.getByRole('link', { name: 'Register', exact: true }).click(); await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible(); await noOverflow(page, 'Register');
    expect(issues).toEqual([]);
  });
}
const viewports = [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 768, height: 1024 }, { width: 390, height: 844 }];
for (const role of ['inventory_worker', 'supervisor', 'admin']) for (const viewport of viewports) {
  test(role + ' workspaces at ' + viewport.width, async ({ page }) => {
    await page.setViewportSize(viewport); const issues = await fixtures(page, role);
    const paths = role === 'inventory_worker' ? ['/inventory/dashboard','/inventory/products','/inventory/stock','/inventory/notifications','/inventory/profile'] : role === 'supervisor' ? ['/supervisor/dashboard','/supervisor/inventory','/supervisor/stock-approvals','/supervisor/system-configuration','/supervisor/profile','/supervisor/notifications'] : ['/admin/dashboard','/admin/reports','/admin/roles','/admin/settings'];
    for (const path of paths) {
      await page.goto(path); await expect(page.locator('main h1').first()).toBeVisible(); await page.waitForTimeout(180); await noOverflow(page, path);
      if (path === '/inventory/products') { await expect(page.getByText('QA Rice', { exact: true })).toBeVisible(); await page.getByRole('button', { name: '+ Add New Product' }).click(); const dialog = page.getByRole('dialog', { name: 'Add New Product' }); await expect(dialog).toBeVisible(); await expect(dialog.getByRole('textbox', { name: 'SKU', exact: true })).toHaveAttribute('readonly', ''); await noOverflow(page, 'Product dialog'); await page.keyboard.press('Escape'); }
      if (path.endsWith('/profile') && role !== 'admin') await expect(page.getByRole('img', { name: 'Maria Santos avatar' }).first()).toBeVisible();
      if (path.includes('dashboard') && viewport.width === 1366) await page.screenshot({ path: '../tmp/browser-results/' + role + '-desktop.png', fullPage: true });
    }
    expect(issues).toEqual([]);
  });
}
