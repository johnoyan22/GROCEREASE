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