export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';

export function apiRequest(path, options = {}) {
  const token = localStorage.getItem('auth_token');
  const headers = new Headers(options.headers);

  headers.set('Accept', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
}

export function clearSession() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_role');
  localStorage.removeItem('user_profile');
}

export async function logoutSession() {
  try {
    if (localStorage.getItem('auth_token')) {
      await apiRequest('/logout', { method: 'POST' });
    }
  } catch {
    // A local logout must still succeed when the API is unavailable.
  } finally {
    clearSession();
  }
}
