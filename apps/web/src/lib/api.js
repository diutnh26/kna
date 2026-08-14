// Thin fetch wrapper around @kna/api. Every screen that used to read a
// hard-coded mock array calls one of these instead.

/**
 * Accepts a base URL with or without a scheme. Render's blueprint wiring
 * supplies a bare hostname, and fetch() would treat that as a relative path
 * — every call would quietly hit the frontend's own origin and 404.
 *
 * The localhost default sits behind `import.meta.env.DEV` so it is compiled
 * out of production bundles entirely, rather than lingering as an unused
 * string. That keeps CI's "does the bundle mention localhost" check honest —
 * a literal that is present but unreachable makes the check cry wolf, and a
 * check that cries wolf gets deleted.
 */
function normalizeApiUrl(value) {
  if (!value) {
    if (import.meta.env.DEV) return 'http://localhost:4000';
    // Unreachable: the production build fails without VITE_API_URL, in
    // apps/web/vite.config.js. Here in case that guard is ever removed.
    throw new Error('VITE_API_URL was not set when this bundle was built.');
  }
  if (/^https?:\/\//i.test(value)) return value.replace(/\/$/, '');
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(value);
  return `${isLocal ? 'http' : 'https'}://${value}`.replace(/\/$/, '');
}

const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL);

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data;
}

function query(params = {}) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  const qs = new URLSearchParams(clean).toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  signup: (payload) => request('/auth/signup', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: (token) => request('/auth/me', { token }),

  listings: (params) => request(`/listings${query(params)}`),
  listing: (id) => request(`/listings/${id}`),
  products: (params) => request(`/products${query(params)}`),

  createBooking: (payload, token) => request('/bookings', { method: 'POST', body: payload, token }),
  myBookings: (token) => request('/bookings/mine', { token }),
  pendingBookings: (token) => request('/bookings/pending', { token }),
  decideBooking: (id, payload, token) =>
    request(`/bookings/${id}/decision`, { method: 'POST', body: payload, token }),
  providerDashboard: (token) => request('/providers/me', { token }),
  createOrder: (payload, token) => request('/orders', { method: 'POST', body: payload, token }),

  archive: (params) => request(`/archive${query(params)}`),
  archiveTypes: () => request('/archive/types'),
  archivePillars: () => request('/archive/pillars'),
  archivePhrases: () => request('/archive/phrases'),
  archiveStats: () => request('/archive/stats'),
  submitArchiveEntry: (payload, token) => request('/archive', { method: 'POST', body: payload, token }),
  myArchiveEntries: (token) => request('/archive/mine', { token }),
  reviewQueue: (token) => request('/archive/queue', { token }),
  reviewedEntries: (token) => request('/archive/reviewed', { token }),
  reviewEntry: (id, payload, token) =>
    request(`/archive/${id}/review`, { method: 'POST', body: payload, token }),

  ledger: (limit) => request(`/community/ledger${query({ limit })}`),
  fund: () => request('/community/fund'),
  decisions: () => request('/community/decisions'),
  committee: () => request('/community/committee'),
  communityStats: () => request('/community/stats'),
};
