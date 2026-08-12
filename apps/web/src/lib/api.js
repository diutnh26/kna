// Thin fetch wrapper around @kna/api. Every screen that used to read a
// hard-coded mock array calls one of these instead.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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
