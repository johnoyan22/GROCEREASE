// API helpers for AI Recommendation and Order Preparation.
// Kept in its own file so the shared services/api.js is not edited.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
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

async function request(path, options = {}) {
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

// ===== Shopper AI Recommendation =====

export function getShopperRecommendations(cartProductIds = []) {
  const params = new URLSearchParams();
  cartProductIds.forEach((id) => params.append('cart_product_ids[]', id));
  const query = params.toString();

  return request(`/shopper/ai-recommendations${query ? `?${query}` : ''}`);
}

export async function askShopperAi(query) {
  const xsrfToken = await getXsrfToken();

  return request('/shopper/ai-recommendations/ask', {
    method: 'POST',
    headers: { 'X-XSRF-TOKEN': xsrfToken },
    body: JSON.stringify({ query }),
  });
}

export function getProductAlternatives(productId) {
  return request(`/shopper/ai-recommendations/alternatives/${productId}`);
}