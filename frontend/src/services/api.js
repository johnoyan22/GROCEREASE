const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8000/api';
const BACKEND_URL = API_URL.replace('/api', '');

export async function getXsrfToken() {
  const response = await fetch(`${BACKEND_URL}/sanctum/csrf-cookie`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Could not start a secure session.');
  }

  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith('XSRF-TOKEN='));

  if (!cookie) {
    throw new Error('The security cookie was not found.');
  }

  return decodeURIComponent(cookie.substring('XSRF-TOKEN='.length));
}

async function sendRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || 'The request failed.');
    error.status = response.status;
    error.errors = data.errors || {};
    throw error;
  }
  if (options.method && options.method !== 'GET' && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('grocerease-data-changed'));
  }
  return data;
}

export function getDashboardSummary({ signal } = {}) {
  return sendRequest('/dashboard/summary', { signal, cache: 'no-store' });
}

export function getPublicStoreLocations({ signal } = {}) {
  return sendRequest('/public/store-locations', { signal, cache: 'no-store' });
}
export function getPublicProducts(id, filters = {}, { signal } = {}) {
  const query = new URLSearchParams();
  for (const key of ['search', 'category', 'page', 'per_page']) if (filters[key] != null && filters[key] !== '') query.set(key, String(filters[key]));
  return sendRequest('/public/stores/' + encodeURIComponent(id) + '/products?' + query, { signal, cache: 'no-store' });
}
export function getAdminStoreLocation(id, { signal } = {}) {
  return sendRequest('/admin/stores/' + encodeURIComponent(id) + '/map-location', { signal, cache: 'no-store' });
}
export function saveAdminStoreLocation(id, details) {
  const { latitude, longitude, verified, verification_note, expected_address } = details;
  return writeAction('/admin/stores/' + encodeURIComponent(id) + '/map-location', 'PUT', { latitude, longitude, verified, verification_note, expected_address });
}

export function getAdminAccounts({ signal } = {}) { return sendRequest('/admin/accounts', { signal, cache: 'no-store' }); }
export function updateAccountStatus(id, status, reason) { return writeAction(`/admin/accounts/${encodeURIComponent(id)}/status`, 'PUT', { account_status: status, reason }); }

export async function login(credentials) {
  const xsrfToken = await getXsrfToken();

  const data = await sendRequest('/login', {
    method: 'POST',
    headers: {
      'X-XSRF-TOKEN': xsrfToken,
    },
    body: JSON.stringify(credentials),
  });

  return data.user;
}

export async function register(details) {
  const xsrfToken = await getXsrfToken();

  return sendRequest('/register', {
    method: 'POST',
    headers: {
      'X-XSRF-TOKEN': xsrfToken,
    },
    body: JSON.stringify(details),
  });
}

export async function getCurrentUser() {
  const data = await sendRequest('/user');
  return data;
}

export async function logout() {
  const xsrfToken = await getXsrfToken();

  return sendRequest('/logout', {
    method: 'POST',
    headers: {
      'X-XSRF-TOKEN': xsrfToken,
    },
  });
}

export async function resendVerificationEmail() {
  const xsrfToken = await getXsrfToken();

  return sendRequest('/email/verification-notification', {
    method: 'POST',
    headers: {
      'X-XSRF-TOKEN': xsrfToken,
    },
  });
}

export async function updateShopperProfile(details) {
  const xsrfToken = await getXsrfToken();

  return sendRequest('/shopper/profile', {
    method: 'PUT',
    headers: {
      'X-XSRF-TOKEN': xsrfToken,
    },
    body: JSON.stringify({
      first_name: details.first_name,
      last_name: details.last_name,
      address: details.address,
    }),
  });
}

export async function changeShopperPassword(details) {
  const xsrfToken = await getXsrfToken();

  return sendRequest('/shopper/password', {
    method: 'PUT',
    headers: {
      'X-XSRF-TOKEN': xsrfToken,
    },
    body: JSON.stringify({
      current_password: details.current_password,
      password: details.password,
      password_confirmation: details.password_confirmation,
    }),
  });
}

export async function changeSupervisorPassword(details) {
  const xsrfToken = await getXsrfToken();

  return sendRequest('/supervisor/password', {
    method: 'PUT',
    headers: {
      'X-XSRF-TOKEN': xsrfToken,
    },
    body: JSON.stringify({
      current_password: details.current_password,
      password: details.password,
      password_confirmation: details.password_confirmation,
    }),
  });
}

export async function changeInventoryPassword(details) {
  const xsrfToken = await getXsrfToken();

  return sendRequest('/inventory/password', {
    method: 'PUT',
    headers: {
      'X-XSRF-TOKEN': xsrfToken,
    },
    body: JSON.stringify({
      current_password: details.current_password,
      password: details.password,
      password_confirmation: details.password_confirmation,
    }),
  });
}

export async function changeAdminPassword(details) {
  const xsrfToken = await getXsrfToken();

  return sendRequest('/admin/password', {
    method: 'PUT',
    headers: {
      'X-XSRF-TOKEN': xsrfToken,
    },
    body: JSON.stringify({
      current_password: details.current_password,
      password: details.password,
      password_confirmation: details.password_confirmation,
    }),
  });
}

export function getAssignedStore({ signal } = {}) {
  return sendRequest('/staff/store', { signal });
}

export function getInventoryItems({ signal } = {}) {
  return sendRequest('/inventory/items', { signal });
}

function productDetails(details) {
  return {
    product_name: details.product_name,
    barcode: details.barcode,
    size: details.size,
    category_id: details.category_id,
    selling_unit: details.selling_unit,
    selling_price: details.selling_price,
    status: details.status,
  };
}

export async function createStoreProduct(details) {
  const xsrfToken = await getXsrfToken();
  return sendRequest('/inventory/items', {
    method: 'POST',
    headers: { 'X-XSRF-TOKEN': xsrfToken },
    body: JSON.stringify(productDetails(details)),
  });
}

export async function updateStoreProduct(id, details) {
  const xsrfToken = await getXsrfToken();
  return sendRequest(`/inventory/items/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'X-XSRF-TOKEN': xsrfToken },
    body: JSON.stringify(productDetails(details)),
  });
}

export function getAdminStaffAssignments({ signal } = {}) {
  return sendRequest('/admin/staff-store-assignments', { signal });
}

export async function createAdminStaff(details) {
  const xsrfToken = await getXsrfToken();
  return sendRequest('/admin/staff', {
    method: 'POST',
    headers: { 'X-XSRF-TOKEN': xsrfToken },
    body: JSON.stringify({
      first_name: details.first_name,
      last_name: details.last_name,
      email: details.email,
      phone_number: details.phone_number,
      address: details.address,
      role: details.role,
      password: details.password,
      password_confirmation: details.password_confirmation,
    }),
  });
}

export async function approveAdminStaff(id) {
  const xsrfToken = await getXsrfToken();
  return sendRequest(`/admin/staff/${encodeURIComponent(id)}/approval`, {
    method: 'PUT',
    headers: { 'X-XSRF-TOKEN': xsrfToken },
    body: JSON.stringify({}),
  });
}

export async function assignAdminStaffStore(id, storeId) {
  const xsrfToken = await getXsrfToken();
  return sendRequest(`/admin/staff/${encodeURIComponent(id)}/store-assignment`, {
    method: 'PUT',
    headers: { 'X-XSRF-TOKEN': xsrfToken },
    body: JSON.stringify({ store_id: storeId }),
  });
}

export function getAdminStores({ signal } = {}) {
  return sendRequest('/admin/stores', { signal });
}

export async function createAdminStore(details) {
  const xsrfToken = await getXsrfToken();
  return sendRequest('/admin/stores', {
    method: 'POST',
    headers: { 'X-XSRF-TOKEN': xsrfToken },
    body: JSON.stringify({ store_name: details.store_name, address: details.address }),
  });
}

export async function updateAdminStore(id, details) {
  const xsrfToken = await getXsrfToken();
  return sendRequest(`/admin/stores/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'X-XSRF-TOKEN': xsrfToken },
    body: JSON.stringify({ store_name: details.store_name, address: details.address }),
  });
}

export async function updateAdminStoreStatus(id, status) {
  const xsrfToken = await getXsrfToken();
  return sendRequest(`/admin/stores/${encodeURIComponent(id)}/status`, {
    method: 'PUT',
    headers: { 'X-XSRF-TOKEN': xsrfToken },
    body: JSON.stringify({ status }),
  });
}

export function getSupervisorStaff({ signal } = {}) {
  return sendRequest('/supervisor/staff', { signal });
}

export async function assignSupervisorStaff(id) {
  const xsrfToken = await getXsrfToken();
  return sendRequest(`/supervisor/staff/${encodeURIComponent(id)}/store-assignment`, {
    method: 'PUT',
    headers: { 'X-XSRF-TOKEN': xsrfToken },
    body: JSON.stringify({}),
  });
}

export function getStockAdjustments({ signal } = {}) {
  return sendRequest('/inventory/stock-adjustments', { signal });
}

export function getLowStockReports({ signal } = {}) {
  return sendRequest('/inventory/low-stock-reports', { signal });
}

export function getAvailabilityHistory({ signal } = {}) {
  return sendRequest('/inventory/availability-history', { signal });
}

export async function submitStockAdjustment(id, details) {
  const xsrfToken = await getXsrfToken();
  return sendRequest(`/inventory/items/${encodeURIComponent(id)}/stock-adjustments`, {
    method: 'POST',
    headers: { 'X-XSRF-TOKEN': xsrfToken },
    body: JSON.stringify({
      requested_hard_stock_qty: details.requested_hard_stock_qty,
      expected_stock_version: details.expected_stock_version,
      reason: details.reason,
    }),
  });
}

export async function submitLowStockReport(id, note) {
  const xsrfToken = await getXsrfToken();
  return sendRequest(`/inventory/items/${encodeURIComponent(id)}/low-stock-reports`, {
    method: 'POST',
    headers: { 'X-XSRF-TOKEN': xsrfToken },
    body: JSON.stringify({ note }),
  });
}

export async function decideStockAdjustment(id, decision, note) {
  const xsrfToken = await getXsrfToken();
  return sendRequest(`/supervisor/stock-adjustments/${encodeURIComponent(id)}/decision`, {
    method: 'PUT',
    headers: { 'X-XSRF-TOKEN': xsrfToken },
    body: JSON.stringify({ decision, decision_note: note }),
  });
}

export async function updateInventoryPolicy(id, details) {
  const xsrfToken = await getXsrfToken();
  return sendRequest(`/supervisor/inventory/items/${encodeURIComponent(id)}/policy`, {
    method: 'PUT',
    headers: { 'X-XSRF-TOKEN': xsrfToken },
    body: JSON.stringify({ max_per_order: details.max_per_order, low_stock_threshold: details.low_stock_threshold }),
  });
}

export function getShopperStores({ signal } = {}) {
  return sendRequest('/shopper/stores', { signal });
}

export function getShopperProducts(storeId, { signal } = {}) {
  return sendRequest(`/shopper/stores/${encodeURIComponent(storeId)}/products`, { signal });
}

export async function getCheckoutQuote(cart, { signal } = {}) {
  const xsrfToken = await getXsrfToken();
  return sendRequest('/shopper/checkout/quote', {
    method: 'POST', signal,
    headers: { 'X-XSRF-TOKEN': xsrfToken },
    body: JSON.stringify({ store_id: cart.store_id, items: checkoutItems(cart.items), pickup_date: cart.pickup_date, pickup_start: cart.pickup_start, pickup_end: cart.pickup_end, ...checkoutPayment(cart) }),
  });
}

export async function createCopOrder(cart, quoteToken, key) {
  const xsrfToken = await getXsrfToken();
  return sendRequest('/shopper/orders', {
    method: 'POST',
    headers: { 'X-XSRF-TOKEN': xsrfToken },
    body: JSON.stringify({ store_id: cart.store_id, items: checkoutItems(cart.items), pickup_date: cart.pickup_date, pickup_start: cart.pickup_start, pickup_end: cart.pickup_end, ...checkoutPayment(cart), quote_token: quoteToken, idempotency_key: key }),
  });
}

function checkoutItems(items) {
  return items.map(function (item) {
    return { store_inventory_id: item.store_inventory_id, quantity: item.quantity };
  });
}

function checkoutPayment(cart) {
  return cart.payment_method ? { payment_method: cart.payment_method, ...(cart.payment_method === 'digital' ? { payment_channel: cart.payment_channel } : {}) } : {};
}

export const createCheckoutOrder = createCopOrder;
export function getPaymentOptions(storeId, { signal } = {}) {
  return sendRequest(`/shopper/stores/${encodeURIComponent(storeId)}/payment-options`, { signal, cache: 'no-store' });
}
export function startPaymentSession(orderId) { return writeAction(`/shopper/orders/${encodeURIComponent(orderId)}/payment-session`, 'POST', {}); }
export function getPaymentSession(orderId, { signal } = {}) { return sendRequest(`/shopper/orders/${encodeURIComponent(orderId)}/payment-session`, { signal, cache: 'no-store' }); }

export function findCheckoutAttempt(key, { signal } = {}) {
  return sendRequest(`/shopper/checkout-attempts/${encodeURIComponent(key)}`, { signal });
}

export function getShopperOrders({ signal } = {}) {
  return sendRequest('/shopper/orders', { signal });
}

export function getStaffOrders({ signal } = {}) {
  return sendRequest('/staff/orders', { signal });
}

export async function cancelShopperOrder(id, reason) {
  const xsrfToken = await getXsrfToken();
  return sendRequest(`/shopper/orders/${encodeURIComponent(id)}/cancellation`, {
    method: 'PUT', headers: { 'X-XSRF-TOKEN': xsrfToken }, body: JSON.stringify({ reason }),
  });
}

export async function updateOrderStatus(id, status) {
  const xsrfToken = await getXsrfToken();
  return sendRequest(`/supervisor/orders/${encodeURIComponent(id)}/status`, {
    method: 'PUT', headers: { 'X-XSRF-TOKEN': xsrfToken }, body: JSON.stringify({ status }),
  });
}

export function getStoreWorkers({ signal } = {}) {
  return sendRequest('/supervisor/workers', { signal });
}

export async function createStoreWorker(details) {
  const xsrfToken = await getXsrfToken();
  return sendRequest('/supervisor/workers', {
    method: 'POST', headers: { 'X-XSRF-TOKEN': xsrfToken },
    body: JSON.stringify({ full_name: details.full_name, work_type: details.work_type }),
  });
}

export async function updateStoreWorker(id, details) {
  const xsrfToken = await getXsrfToken();
  return sendRequest(`/supervisor/workers/${encodeURIComponent(id)}`, {
    method: 'PUT', headers: { 'X-XSRF-TOKEN': xsrfToken },
    body: JSON.stringify({ full_name: details.full_name, work_type: details.work_type, status: details.status }),
  });
}

export function getOrderPickup(id, { signal } = {}) {
  return sendRequest(`/shopper/orders/${encodeURIComponent(id)}/pickup`, { signal, cache: 'no-store' });
}

export async function confirmOrderCash(id, details) {
  const xsrfToken = await getXsrfToken();
  return sendRequest(`/supervisor/orders/${encodeURIComponent(id)}/cash-payment`, {
    method: 'PUT', headers: { 'X-XSRF-TOKEN': xsrfToken },
    body: JSON.stringify({ cashier_name: details.cashier_name, evidence_reference: details.evidence_reference, cash_collected: details.cash_collected }),
  });
}

export async function verifyOrderPickup(id, details) {
  const xsrfToken = await getXsrfToken();
  return sendRequest(`/supervisor/orders/${encodeURIComponent(id)}/pickup-verification`, {
    method: 'POST', headers: { 'X-XSRF-TOKEN': xsrfToken },
    body: JSON.stringify({ method: details.method, credential: details.credential, claimant_name: details.claimant_name,
      identity_checked: details.identity_checked, claimant_check_note: details.claimant_check_note }),
  });
}

export async function recordOrderHandover(id) {
  const xsrfToken = await getXsrfToken();
  return sendRequest(`/supervisor/orders/${encodeURIComponent(id)}/handover`, {
    method: 'PUT', headers: { 'X-XSRF-TOKEN': xsrfToken }, body: JSON.stringify({ physically_handed_over: true }),
  });
}

async function writeAction(path, method, body) {
  const xsrfToken = await getXsrfToken();
  return sendRequest(path, { method, headers: { 'X-XSRF-TOKEN': xsrfToken }, body: JSON.stringify(body) });
}

export function getStorePickupSettings(id, { signal } = {}) {
  return sendRequest(`/admin/stores/${encodeURIComponent(id)}/pickup-settings`, { signal, cache: 'no-store' });
}
export function getSupervisorPickupSettings({ signal } = {}) {
  return sendRequest('/supervisor/pickup-settings', { signal, cache: 'no-store' });
}
export function getSupervisorPickupHours(date, { signal } = {}) {
  return sendRequest(`/supervisor/pickup-hours?date=${encodeURIComponent(date)}`, { signal, cache: 'no-store' });
}
export function saveSupervisorPickupSettings(hours, pickupHours, holdingHours) {
  return writeAction('/supervisor/pickup-settings', 'PUT', { operating_hours: hours, pickup_service_hours: pickupHours, paid_order_holding_hours: holdingHours });
}
export function suspendSupervisorPickupDate(date, reason) {
  return writeAction('/supervisor/pickup-closures', 'POST', { date, reason });
}
export function getPickupHours(id, date, { signal } = {}) {
  return sendRequest(`/shopper/stores/${encodeURIComponent(id)}/pickup-hours?date=${encodeURIComponent(date)}`, { signal });
}
export function assignOrderWorker(id, workerId, reason) {
  return writeAction(`/supervisor/orders/${encodeURIComponent(id)}/worker`, 'PUT', { worker_id: workerId, reason });
}
export function saveOrderPreparation(id, items) {
  return writeAction(`/staff/orders/${encodeURIComponent(id)}/preparation`, 'PUT', { items: items.map(function (item) { return { order_item_id: item.order_item_id, prepared_qty: item.prepared_qty }; }) });
}
export function completeOrderPreparation(id, note) {
  return writeAction(`/supervisor/orders/${encodeURIComponent(id)}/preparation-completion`, 'PUT', { completion_note: note });
}
export function rescheduleOrder(id, selection, reason) {
  return writeAction(`/supervisor/orders/${encodeURIComponent(id)}/pickup-schedule`, 'PUT', { pickup_date: selection.pickup_date, pickup_start: selection.pickup_start, pickup_end: selection.pickup_end, reason });
}
export function confirmOrderResale(id, reason) {
  return writeAction(`/supervisor/orders/${encodeURIComponent(id)}/resale-disposition`, 'PUT', { all_items_suitable_for_resale: true, reason });
}
export function requestOrderRefundReview(id, reason) {
  return writeAction(`/supervisor/orders/${encodeURIComponent(id)}/refund-review`, 'PUT', { reason });
}
export function getCopStatus({ signal } = {}) { return sendRequest('/shopper/cop-status', { signal }); }
export function getOrderNotifications({ signal } = {}) { return sendRequest('/shopper/order-notifications', { signal }); }
export function readOrderNotification(id) { return writeAction(`/shopper/order-notifications/${encodeURIComponent(id)}/read`, 'PUT', {}); }
export function getCopStrikes({ signal } = {}) { return sendRequest('/admin/cop-strikes', { signal }); }
export function correctCopStrike(id, reason) { return writeAction(`/admin/cop-strikes/${encodeURIComponent(id)}/correction`, 'PUT', { reason }); }
export function getTransactionRecords(role, { signal } = {}) {
  const prefix = role === 'admin' ? 'admin' : 'supervisor';
  return sendRequest(`/${prefix}/transactions`, { signal });
}
export function getOrderReceipt(id, role, { signal } = {}) {
  let prefix = 'shopper';
  if (role === 'admin') prefix = 'admin';
  if (role === 'supervisor') prefix = 'supervisor';
  return sendRequest(`/${prefix}/orders/${encodeURIComponent(id)}/receipt`, { signal, cache: 'no-store' });
}

export async function uploadProfilePhoto(photo) {
  const token = await getXsrfToken(); const body = new FormData(); body.append('photo', photo);
  return sendRequest('/shopper/profile/photo', { method: 'POST', body, headers: { 'X-XSRF-TOKEN': token } });
}
export function removeProfilePhoto() { return writeAction('/shopper/profile/photo', 'DELETE', {}); }

export function getStoreCategories({ signal } = {}) { return sendRequest('/inventory/categories', { signal, cache: 'no-store' }); }
export function saveStoreCategory(id, details) { return writeAction(id ? '/supervisor/categories/' + encodeURIComponent(id) : '/supervisor/categories', id ? 'PUT' : 'POST', { name: details.name, active: details.active }); }
export async function uploadProductPhoto(id, photo) { const token = await getXsrfToken(); const body = new FormData(); body.append('photo', photo); return sendRequest('/inventory/items/' + encodeURIComponent(id) + '/photo', { method: 'POST', body, headers: { 'X-XSRF-TOKEN': token } }); }
export function removeProductPhoto(id) { return writeAction('/inventory/items/' + encodeURIComponent(id) + '/photo', 'DELETE', {}); }
export function getStockReceiving({ signal } = {}) { return sendRequest('/inventory/receiving', { signal, cache: 'no-store' }); }
export function submitStockReceiving(id, details) { const { kind, quantity, received_date, expiration_date, batch_reference, batch_id, description } = details; return writeAction('/inventory/items/' + encodeURIComponent(id) + '/receiving', 'POST', { kind, quantity, received_date, expiration_date, batch_reference, batch_id, description }); }
export function decideStockReceiving(id, decision, decision_note) { return writeAction('/supervisor/receiving/' + encodeURIComponent(id) + '/decision', 'PUT', { decision, decision_note }); }
export function quarantineStockBatch(id, description) { return writeAction('/supervisor/batches/' + encodeURIComponent(id) + '/quarantine', 'PUT', { description }); }
export async function previewStockImport(file) { const token = await getXsrfToken(); const body = new FormData(); body.append('file', file); return sendRequest('/inventory/receiving/preview', { method: 'POST', body, headers: { 'X-XSRF-TOKEN': token } }); }
export function submitStockImport(preview_token) { return writeAction('/inventory/receiving/import', 'POST', { preview_token }); }
export function getStockAlerts({ signal } = {}) { return sendRequest('/inventory/stock-alerts', { signal, cache: 'no-store' }); }
export function getProductPriceHistory(id, { signal } = {}) { return sendRequest('/inventory/items/' + encodeURIComponent(id) + '/price-history', { signal, cache: 'no-store' }); }
export function acknowledgeStockAlert(id) { return writeAction('/inventory/stock-alerts/' + encodeURIComponent(id) + '/read', 'PUT', {}); }
export async function downloadStockTemplate() { await downloadAuthenticated('/inventory/receiving/template', 'stock-receiving-template.csv', 'text/csv'); return { message: 'CSV template downloaded.' }; }
export async function downloadAuthenticated(path, filename, mime = 'application/pdf') {
  const response = await fetch(API_URL + path, { credentials: 'include', cache: 'no-store', headers: { Accept: mime } });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || 'The download is unavailable.'); }
  if (!response.headers.get('content-type')?.includes(mime)) throw new Error('The server returned an unexpected document type.');
  const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function lookupOrderReference(reference) { return sendRequest('/supervisor/order-lookup?' + new URLSearchParams({ reference }), { cache: 'no-store' }); }
export function generateOrderInvoice(id, role) { return writeAction('/' + role + '/orders/' + encodeURIComponent(id) + '/invoice', 'POST', {}); }
export function downloadOrderInvoice(id, role) { return downloadAuthenticated('/' + role + '/orders/' + encodeURIComponent(id) + '/invoice.pdf', 'grocerease-order-' + id + '-pro-forma.pdf'); }
export function getInvoiceSettings(id, { signal } = {}) { return sendRequest('/admin/stores/' + encodeURIComponent(id) + '/invoice-settings', { signal, cache: 'no-store' }); }
export function saveInvoiceSettings(id, details) {
  const { registered_name, registered_address, tin, branch_code, tax_registration, numbering_authority, review_notes } = details;
  return writeAction('/admin/stores/' + encodeURIComponent(id) + '/invoice-settings', 'PUT', { registered_name, registered_address, tin, branch_code, tax_registration, numbering_authority, review_notes });
}
export function downloadReportPdf(role, kind, filters = {}) {
  const query = new URLSearchParams();
  for (const key of ['from','until','store_id','search','status','category','upcoming']) if (filters[key] != null && filters[key] !== '' && filters[key] !== false) query.set(key, filters[key] === true ? '1' : String(filters[key]));
  return downloadAuthenticated('/' + reportPrefix(role) + '/reports/' + encodeURIComponent(kind) + '.pdf?' + query, 'grocerease-' + kind + '.pdf');
}

function reportPrefix(role) {
  const prefix = { inventory_worker: 'inventory', supervisor: 'supervisor', admin: 'admin' }[role];
  if (!prefix) throw new Error('Reports are available only to authorized staff.');
  return prefix;
}
export function getReportData(role, kind, filters = {}, { signal } = {}) {
  const query = new URLSearchParams();
  for (const key of ['from','until','store_id','search','status','category','upcoming','page']) if (filters[key] != null && filters[key] !== '' && filters[key] !== false) query.set(key, filters[key] === true ? '1' : String(filters[key]));
  return sendRequest('/' + reportPrefix(role) + '/reports/' + encodeURIComponent(kind) + '?' + query, { signal, cache: 'no-store' });
}
