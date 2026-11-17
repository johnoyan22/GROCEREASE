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
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
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

export function getInventoryItems({ signal, includeBatches = true } = {}) {
  return sendRequest('/inventory/items' + (includeBatches ? '' : '?include_batches=0'), { signal });
}

export function getInventoryBatches(id, { page = 1, includeEmpty = false, signal } = {}) {
  const query = new URLSearchParams({ page: String(page), include_empty: includeEmpty ? '1' : '0' });
  return sendRequest(`/inventory/items/${encodeURIComponent(id)}/batches?${query}`, { signal, cache: 'no-store' });
}

function productDetails(details) {
  return {
    product_name: details.product_name,
    barcode: details.barcode,
    size: details.size,
    size_amount: details.size_amount,
    size_unit: details.size_unit,
    selling_unit: details.selling_unit,
    category_id: details.category_id,
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

export function getCorrectionBatches({ page = 1, search = '', product = '', condition = '', includeEmpty = false, signal } = {}) {
  const query = new URLSearchParams({ page: String(page), search, product: String(product), condition, include_empty: includeEmpty ? '1' : '0' });
  return sendRequest('/inventory/correction-batches?' + query, { signal, cache: 'no-store' });
}

export function getStockAdjustments({ signal } = {}) {
  return sendRequest('/inventory/stock-adjustments', { signal });
}

export function getStockReceipts({ signal } = {}) {
  return sendRequest('/inventory/stock-receipts', { signal });
}

export async function submitStockReceipt(id, details) {
  const xsrfToken = await getXsrfToken();
  return sendRequest(`/inventory/items/${encodeURIComponent(id)}/stock-receipts`, {
    method: 'POST', headers: { 'X-XSRF-TOKEN': xsrfToken },
    body: JSON.stringify({ operation_id: details.operation_id, quantity: details.quantity,
      received_date: details.received_date, expiry_date: details.expiry_date, description: details.description }),
  });
}

export async function decideStockReceipt(id, decision, note) {
  const xsrfToken = await getXsrfToken();
  return sendRequest(`/supervisor/stock-receipts/${encodeURIComponent(id)}/decision`, {
    method: 'PUT', headers: { 'X-XSRF-TOKEN': xsrfToken }, body: JSON.stringify({ decision, decision_note: note }),
  });
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
      inventory_batch_id: details.inventory_batch_id,
      operation_id: details.operation_id,
      requested_remaining_quantity: details.requested_remaining_quantity,
      expected_stock_version: details.expected_stock_version,
      reason: details.reason,
    }),
  });
}

export function getAutomaticLowStock({ signal, ...query } = {}) {
  return sendRequest('/inventory/low-stock?' + new URLSearchParams(query), { signal, cache: 'no-store' });
}

export function getLowStockNotifications({ signal, unread = false, ...query } = {}) {
  return sendRequest('/staff/low-stock-notifications?' + new URLSearchParams({ ...query, unread: unread ? '1' : '0' }), { signal, cache: 'no-store' });
}

export async function readLowStockNotification(id) {
  const xsrfToken = await getXsrfToken();
  return sendRequest(`/staff/low-stock-notifications/${encodeURIComponent(id)}/read`, {
    method: 'PUT', headers: { 'X-XSRF-TOKEN': xsrfToken }, body: '{}',
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
export function saveSupervisorPickupSettings(hours, pickupHours, holdingHours, preparationMinutes, windowMinutes) {
  return writeAction('/supervisor/pickup-settings', 'PUT', { operating_hours: hours, pickup_service_hours: pickupHours, paid_order_holding_hours: holdingHours, pickup_preparation_minutes: preparationMinutes, pickup_window_minutes: windowMinutes });
}
export function suspendSupervisorPickupDate(date, reason) {
  return writeAction('/supervisor/pickup-closures', 'POST', { date, reason });
}
export function getPickupHours(id, date, { signal } = {}) {
  return sendRequest(`/shopper/stores/${encodeURIComponent(id)}/pickup-hours` + (date ? `?date=${encodeURIComponent(date)}` : ''), { signal, cache: 'no-store' });
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

export function getOrderSummary(id, role, { signal } = {}) {
  const prefix = role === 'supervisor' ? 'supervisor' : 'shopper';
  return sendRequest(`/${prefix}/orders/${encodeURIComponent(id)}/summary`, { signal, cache: 'no-store' });
}
export function lookupOrderReference(reference, { signal } = {}) {
  return sendRequest('/supervisor/order-reference?' + new URLSearchParams({ reference }), { signal, cache: 'no-store' });
}
export async function resolvePickup(details, { signal } = {}) {
  const token = await getXsrfToken();
  return sendRequest('/supervisor/pickup/resolve', { method: 'POST', signal, cache: 'no-store', headers: { 'X-XSRF-TOKEN': token },
    body: JSON.stringify({ method: details.method, credential: details.credential, ...(details.method === 'pin' ? { reference: details.reference } : {}), ...(details.order_context ? { order_context: details.order_context } : {}) }) });
}
export function claimOrderPickup(id, details) {
  return writeAction(`/supervisor/orders/${encodeURIComponent(id)}/claim`, 'POST', { method: details.method, credential: details.credential,
    claiming_as: details.claiming_as, ...(details.claiming_as === 'representative' ? { claimant_name: details.claimant_name } : {}),
    claimant_check_note: details.claimant_check_note, identity_checked: details.identity_checked, physically_handed_over: details.physically_handed_over });
}

export function getReportOptions({ signal } = {}) { return sendRequest('/reports/options', { signal, cache: 'no-store' }); }
export function generateReport(filters, { signal } = {}) {
  return getXsrfToken().then(token => sendRequest('/reports', { method: 'POST', signal, cache: 'no-store', headers: { 'X-XSRF-TOKEN': token }, body: JSON.stringify(filters) }));
}
export function getReportPreview(id, pages = {}, { signal } = {}) {
  const query = new URLSearchParams(); Object.entries(pages).forEach(([section, page]) => query.set(`pages[${section}]`, page));
  return sendRequest(`/reports/${encodeURIComponent(id)}?${query}`, { signal, cache: 'no-store' });
}
export async function downloadReportPdf(id, { signal } = {}) {
  const response = await fetch(`${API_URL}/reports/${encodeURIComponent(id)}/pdf`, { signal, credentials: 'include', cache: 'no-store', headers: { Accept: 'application/pdf' } });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const failure = new Error(data.message || 'PDF export failed. Retry while this report is available.'); failure.status = response.status; throw failure;
  }
  if (!(response.headers.get('Content-Type') || '').includes('application/pdf')) throw new Error('The server did not return a PDF. Retry the export.');
  const disposition = response.headers.get('Content-Disposition') || '';
  const filename = disposition.match(/filename="([A-Za-z0-9_.-]+\.pdf)"/)?.[1] || 'GrocerEase-report.pdf';
  return { blob: await response.blob(), filename };
}

export function getCategories({ signal, ...query } = {}) {
  return sendRequest('/staff/categories?' + new URLSearchParams(query), { signal, cache: 'no-store' });
}
export function getCategoryOptions({ signal } = {}) {
  return sendRequest('/staff/category-options', { signal, cache: 'no-store' });
}
async function saveCategory(path, method, details) {
  const xsrfToken = await getXsrfToken();
  return sendRequest(path, { method, headers: { 'X-XSRF-TOKEN': xsrfToken }, body: JSON.stringify(details ? { name: details.name, status: details.status } : {}) });
}
export function createCategory(details) { return saveCategory('/supervisor/categories', 'POST', details); }
export function updateCategory(id, details) { return saveCategory(`/supervisor/categories/${encodeURIComponent(id)}`, 'PUT', details); }
export function deleteCategory(id) { return saveCategory(`/supervisor/categories/${encodeURIComponent(id)}`, 'DELETE'); }
