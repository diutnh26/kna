// Thin fetch wrapper around @kna/api. Every screen that used to read a
// hard-coded mock array calls one of these instead.
//
 // Auth is cookie-based (HttpOnly access + refresh). Every request sends
 // credentials so the browser attaches those cookies. The optional `token`
 // argument on authenticated helpers is kept for call-site compatibility
 // but is no longer sent as a Bearer header — cookies are the source of truth.

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

let refreshInFlight = null;

async function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = request('/auth/refresh', { method: 'POST', _skipRefresh: true })
      .catch((err) => {
        throw err;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function request(path, { method = 'GET', body, token: _token, _skipRefresh = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // One silent refresh + retry when the short-lived access cookie expired.
  if (res.status === 401 && !_skipRefresh && path !== '/auth/refresh' && path !== '/auth/login' && path !== '/auth/signup' && path !== '/auth/google' && path !== '/auth/logout') {
    try {
      await refreshSession();
      return request(path, { method, body, _skipRefresh: true });
    } catch {
      // fall through to the original 401 handling below
    }
  }

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
  googleLogin: (idToken) => request('/auth/google', { method: 'POST', body: { idToken } }),
  refresh: () => request('/auth/refresh', { method: 'POST', _skipRefresh: true }),
  logout: () => request('/auth/logout', { method: 'POST', _skipRefresh: true }),
  me: () => request('/auth/me'),
  verifyEmail: (token) => request(`/auth/verify-email?token=${encodeURIComponent(token)}`),
  resendVerification: () => request('/auth/resend-verification', { method: 'POST' }),

  listings: (params) => request(`/listings${query(params)}`),
  listing: (id) => request(`/listings/${id}`),
  listingAvailability: (id, from, to) => request(`/listings/${id}/availability${query({ from, to })}`),
  products: (params) => request(`/products${query(params)}`),

  createBooking: (payload) => request('/bookings', { method: 'POST', body: payload }),
  myBookings: () => request('/bookings/mine'),
  cancelBooking: (id) => request(`/bookings/${id}/cancel`, { method: 'POST' }),
  // Payment at check-out, from the guest's wallet. A linked Phantom gets
  // { needsSignature, transactionBase64 } back, signs it, then confirms.
  payBooking: (id) => request(`/bookings/${id}/pay`, { method: 'POST' }),
  confirmBookingPayment: (id, signature) =>
    request(`/bookings/${id}/pay/confirm`, { method: 'POST', body: { signature } }),
  providerDashboard: () => request('/providers/me'),
  setAvailability: (listingId, body) =>
    request(`/providers/me/listings/${listingId}/availability`, { method: 'PUT', body }),

  // A person's own account: who they are, and everything they have done
  // here as one timeline rather than three lists.
  account: () => request('/account'),
  updateAccount: (payload) => request('/account', { method: 'PATCH', body: payload }),
  changePassword: (payload) => request('/account/password', { method: 'POST', body: payload }),
  accountActivity: () => request('/account/activity'),

  // The bell polls the count; the list is only fetched when the panel opens.
  notifications: () => request('/notifications'),
  unreadNotifications: () => request('/notifications/unread-count'),
  readNotifications: (payload) =>
    request('/notifications/read', { method: 'POST', body: payload }),

  // Carbon offsets hang off a booking: the guest pays for one with the
  // stay, so there has to be a stay to attach it to.
  offsetBookings: () => request('/offsets/bookings'),
  attachOffset: (payload) => request('/offsets', { method: 'POST', body: payload }),
  removeOffset: (bookingId) => request(`/offsets/${bookingId}`, { method: 'DELETE' }),
  createOrder: (payload) => request('/orders', { method: 'POST', body: payload }),

  archive: (params) => request(`/archive${query(params)}`),
  archiveTypes: () => request('/archive/types'),
  archivePillars: () => request('/archive/pillars'),
  archivePhrases: () => request('/archive/phrases'),
  archiveStats: () => request('/archive/stats'),
  submitArchiveEntry: (payload) => request('/archive', { method: 'POST', body: payload }),
  myArchiveEntries: () => request('/archive/mine'),
  reviewQueue: () => request('/archive/queue'),
  reviewedEntries: () => request('/archive/reviewed'),
  reviewEntry: (id, payload) =>
    request(`/archive/${id}/review`, { method: 'POST', body: payload }),

  ledger: (limit) => request(`/community/ledger${query({ limit })}`),
  fund: () => request('/community/fund'),
  decisions: () => request('/community/decisions'),
  committee: () => request('/community/committee'),
  communityStats: () => request('/community/stats'),

  chainStatus: () => request('/chain/status'),
  chainLedger: (id) => request(`/chain/ledger/${id}`),
  chainPrepare: (id, body) =>
    request(`/chain/ledger/${id}/prepare`, { method: 'POST', body }),
  chainSubmit: (id, body) =>
    request(`/chain/ledger/${id}/submit`, { method: 'POST', body }),
  chainFinalize: (id, body) =>
    request(`/chain/ledger/${id}/finalize`, { method: 'POST', body }),
  chainCancelPrepare: (id, body) =>
    request(`/chain/ledger/${id}/cancel/prepare`, { method: 'POST', body }),
  chainCancel: (id, body) =>
    request(`/chain/ledger/${id}/cancel`, { method: 'POST', body }),
  chainRetry: (id) => request(`/chain/ledger/${id}/retry`, { method: 'POST' }),
  chainReconcile: (id) =>
    request(`/chain/ledger/${id}/reconcile`, { method: 'POST' }),
  chainAwaitingCommittee: () => request('/chain/awaiting-committee'),
  chainFinalizeIx: (id, authority) =>
    request(`/chain/ledger/${id}/finalize-ix${query({ authority })}`),
  chainSquadsProposal: (id, params) =>
    request(`/chain/ledger/${id}/squads-proposal${query(params)}`),

  walletChallenge: () => request('/wallet/challenge', { method: 'POST' }),
  walletLink: (body) => request('/wallet/link', { method: 'POST', body }),
  walletMe: () => request('/wallet/me'),
  // The account's fixed wallet, its funding, and which wallet pays.
  walletAccount: () => request('/wallet/account'),
  walletTopUp: (amountVnd) => request('/wallet/topup', { method: 'POST', body: { amountVnd } }),
  walletFaucet: () => request('/wallet/faucet', { method: 'POST' }),
  walletTopUps: () => request('/wallet/topups'),
  paymentWalletPrepare: () => request('/wallet/payment-wallet/prepare', { method: 'POST' }),
  paymentWalletConfirm: (signature) =>
    request('/wallet/payment-wallet/confirm', { method: 'POST', body: { signature } }),
  paymentWalletReset: () => request('/wallet/payment-wallet/reset', { method: 'POST' }),

  traceWallet: (address) => request(`/trace/wallet/${encodeURIComponent(address)}`),
  traceBooking: (id) => request(`/trace/booking/${encodeURIComponent(id)}`),

  paymentStatus: (ref) => request(`/payments/status/${encodeURIComponent(ref)}`),
  verifyPayment: (ref) =>
    request(`/payments/verify/${encodeURIComponent(ref)}`, { method: 'POST' }),
  demoHistory: () => request('/payments/demo-history'),
};
