const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8000/api';
const BACKEND_URL = API_URL.replace('/api', '');

async function getXsrfToken() {
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
  return data;
}

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
    sku: details.sku,
    barcode: details.barcode,
    size: details.size,
    category: details.category,
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
    body: JSON.stringify({ store_id: cart.store_id, items: checkoutItems(cart.items), pickup_date: cart.pickup_date, pickup_start: cart.pickup_start, pickup_end: cart.pickup_end }),
  });
}

export async function createCopOrder(cart, quoteToken, key) {
  const xsrfToken = await getXsrfToken();
  return sendRequest('/shopper/orders', {
    method: 'POST',
    headers: { 'X-XSRF-TOKEN': xsrfToken },
    body: JSON.stringify({ store_id: cart.store_id, items: checkoutItems(cart.items), pickup_date: cart.pickup_date, pickup_start: cart.pickup_start, pickup_end: cart.pickup_end, quote_token: quoteToken, idempotency_key: key }),
  });
}

function checkoutItems(items) {
  return items.map(function (item) {
    return { store_inventory_id: item.store_inventory_id, quantity: item.quantity };
  });
}

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
