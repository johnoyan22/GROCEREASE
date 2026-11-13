import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Browser fixtures exercise real rendered components. Backend persistence, role/store
// permissions and provider HTTP fakes are separately covered by Laravel tests.
export const store = { store_id: 1, store_name: 'QA Store', address: 'QA address', status: 'active' };
export const timestamp = new Date().toISOString();
export const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + 86400000));
export const product = { store_inventory_id: 7, store_id: 1, product_id: 3, product_name: 'QA Rice', name: 'QA Rice', sku: 'QA-RICE', barcode: '000123', category: 'Staples', category_id: 1, size: '1 kg', selling_unit: 'pack', image_url: null, selling_price: '67.25', hard_stock_qty: 25, soft_stock_qty: 5, available_stock: 20, max_per_order: 5, low_stock_threshold: 4, stock_version: 1, status: 'active', updated_at: timestamp };
export const order = { order_id: 9, order_reference: 'GE-9', store_id: 1, store_name: 'QA Store', store_address: 'QA address', shopper_name: 'Maria Santos', created_at: timestamp, updated_at: timestamp, status: 'ready_for_pickup', claim_status: 'claimable', payment_status: 'unpaid', payment_method: 'cash_on_pickup', reservation_status: 'active', currency: 'PHP', subtotal_centavos: 13450, service_fee_centavos: 0, total_centavos: 13450, pickup_window_start_at: tomorrow + 'T02:00:00Z', pickup_window_end_at: tomorrow + 'T03:00:00Z', claim_expires_at: new Date(Date.now() + 172800000).toISOString(), pickup_schedule_review_required: false, assignments: [], history: [], pickup: { verified_at: null, handed_over_at: null }, refund_status: 'not_required', items: [{ order_item_id: 1, store_inventory_id: 7, product_name: 'QA Rice', sku: 'QA-RICE', size: '1 kg', selling_unit: 'pack', quantity: 2, prepared_qty: 2, unit_price_centavos: 6725, line_total_centavos: 13450 }] };
export async function fixtures(page, role = 'shopper') {
  const issues = []; page.on('pageerror', error => issues.push(error.message));
  await page.context().addCookies([{ name: 'XSRF-TOKEN', value: 'qa-token', domain: 'localhost', path: '/' }]);
  await page.route('http://localhost:8000/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const headers = { 'Access-Control-Allow-Origin': 'http://localhost:5187', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Accept, Content-Type, X-XSRF-TOKEN', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS' };
    const reply = (data, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(data) });
    if (request.method() === 'OPTIONS' || path.endsWith('/csrf-cookie')) return route.fulfill({ status: 204, headers });
    if (path === '/api/user') return role === 'guest' ? reply({ message: 'Unauthenticated.' }, 401) : reply({ id: 5, role: { slug: role, name: role === 'inventory_worker' ? 'Inventory Worker' : role }, email: 'qa@example.test', email_verified_at: timestamp, account_status: 'active', profile: { first_name: 'Maria', last_name: 'Santos', phone_number: '09123456789', address: 'QA address' } });
    if (path === '/api/public/store-locations') return reply({ available: true, stores: [{ ...store, latitude: 10.3, longitude: 123.9 }, { store_id: 2, store_name: 'Second QA Store', address: 'Second verified QA address', latitude: 10.6, longitude: 123.9 }] });
    if (/^\/api\/public\/stores\/\d+\/products\/\d+\/photo$/.test(path)) return route.fulfill({ status: 200, headers, contentType: 'image/webp', body: readFileSync(new URL('../../src/assets/categories/fruit.webp', import.meta.url)) });
    if (/^\/api\/public\/stores\/\d+\/products$/.test(path)) {
      const id = Number(path.split('/')[4]), selected = id === 1 ? store : { store_id: 2, store_name: 'Second QA Store', address: 'Second verified QA address' };
      const sample = id === 1 ? { product_id: 3, store_id: 1, product_name: 'QA Rice', category: 'Staples', size: '1 kg', selling_unit: 'pack', selling_price: '67.25', availability: 'available', image_url: 'http://localhost:8000/api/public/stores/1/products/3/photo' } : { product_id: 4, store_id: 2, product_name: 'Second-store QA milk with a long product name for narrow-screen testing', category: 'Dairy', size: '1 L', selling_unit: 'bottle', selling_price: '123456.78', availability: 'available', image_url: null };
      const search = (url.searchParams.get('search') || '').toLowerCase(), category = url.searchParams.get('category');
      const rows = (!search || (sample.product_name+' '+sample.category+' '+sample.size).toLowerCase().includes(search)) && (!category || sample.category === category) ? [sample] : [];
      return reply({ store: selected, products: rows, categories: [sample.category], pagination: { page: 1, per_page: 12, total: rows.length, last_page: 1 } });
    }
    if (path.includes('/reports/')) {
      if (path.endsWith('.pdf')) return route.fulfill({ status: 200, headers: { ...headers, 'Content-Disposition': 'attachment; filename=qa-report.pdf' }, contentType: 'application/pdf', body: readFileSync(new URL('../fixtures/report-download.pdf', import.meta.url)) });
      const kind = path.split('/').at(-1), stockReport = kind === 'stock' || kind === 'low-stock', scope = role === 'admin' && !url.searchParams.get('store_id') ? 'All stores' : store.store_name;
      return reply({ report: { report_title: stockReport ? 'Current Stock Report' : 'Verified Report', scope, period_label: stockReport ? 'Current snapshot at generation time' : null, from: url.searchParams.get('from'), until: url.searchParams.get('until'), generated_at: 'Nov 13, 2026 04:00 PM (Asia/Manila)', headings: stockReport ? ['Store','Product / SKU','Physical','Reserved','Sellable'] : ['Store','Order','Shopper','Amount'], rows: stockReport ? [[store.store_name,'QA Rice',25,5,20]] : [[store.store_name,'GE-9','Maria Santos','₱134.50']], totals: stockReport ? { Products: 1, 'Physical units': 25, 'Reserved units': 5, 'Sellable units': 20 } : { 'Verified records': 1, 'Gross payments (excluding completed refunds)': '₱134.50' }, note: 'Labeled browser API fixture. Backend tests verify the real dataset and PDF.' }, pagination: { page: 1, per_page: 50, total: 1, last_page: 1 } });
    }
    if (path.endsWith('/map-location')) return reply({ location: null });
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
export async function noOverflow(page, label) {
  await page.waitForTimeout(80);
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, root: document.documentElement.scrollWidth, main: [...document.querySelectorAll('main')].map(el => ({ client: el.clientWidth, scroll: el.scrollWidth })) }));
  expect(dimensions.root, label + ': root overflow').toBeLessThanOrEqual(dimensions.viewport + 1);
  for (const main of dimensions.main) expect(main.scroll, label + ': main overflow').toBeLessThanOrEqual(main.client + 1);
}
export async function shopperTab(page, name) {
  const target = page.getByRole('button', { name, exact: true });
  if (!await target.isVisible()) { await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click(); await page.getByRole('dialog', { name: 'Navigation', exact: true }).getByRole('button', { name, exact: true }).click(); }
  else await target.click();
}
