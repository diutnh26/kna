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

  // A person's own account: who they are, and everything they have done
  // here as one timeline rather than three lists.
  account: (token) => request('/account', { token }),
  updateAccount: (payload, token) => request('/account', { method: 'PATCH', body: payload, token }),
  changePassword: (payload, token) =>
    request('/account/password', { method: 'POST', body: payload, token }),
  accountActivity: (token) => request('/account/activity', { token }),

  // The bell polls the count; the list is only fetched when the panel opens.
  notifications: (token) => request('/notifications', { token }),
  unreadNotifications: (token) => request('/notifications/unread-count', { token }),
  readNotifications: (payload, token) =>
    request('/notifications/read', { method: 'POST', body: payload, token }),

  // Carbon offsets hang off a booking: the guest pays for one with the
  // stay, so there has to be a stay to attach it to.
  offsetBookings: (token) => request('/offsets/bookings', { token }),
  attachOffset: (payload, token) => request('/offsets', { method: 'POST', body: payload, token }),
  removeOffset: (bookingId, token) =>
    request(`/offsets/${bookingId}`, { method: 'DELETE', token }),
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

  // The assistant. `chatHealth` tells the screen what it may promise —
  // full answers, or approved-answers-only while the model host is down.
  chatHealth: () => request('/chat/health'),
  flagAnswer: (payload, token) => request('/chat/flag', { method: 'POST', body: payload, token }),
  assistantFlags: (token) => request('/chat/flags', { token }),
  resolveFlag: (id, payload, token) =>
    request(`/chat/flags/${id}/resolve`, { method: 'POST', body: payload, token }),
};

/**
 * Asks the assistant and streams the reply.
 *
 * Not part of `api` because it is not a JSON request/response: the server
 * answers over server-sent events so the visitor watches the answer being
 * written instead of a spinner. Contract, in order:
 *
 *   onToken(t)  tier B only, as the model writes
 *   onDone(d)   always — and d.answer is AUTHORITATIVE. A draft that
 *               fails the server's grounding check streams tokens and is
 *               then replaced by a refusal, so the caller must render
 *               d.answer, never its own accumulation.
 *   onError(e)  {code: "busy" | "failed"}
 */
export async function chatStream({ message, sessionId, locale, onToken, onDone, onError, signal }) {
  const res = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId, locale }),
    signal,
  });

  if (!res.ok || !res.body) {
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json().catch(() => null) : null;
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const handle = (block) => {
    const event = /event: (\w+)/.exec(block)?.[1];
    const dataLine = block.split('\n').find((line) => line.startsWith('data: '));
    if (!event || !dataLine) return;
    let data;
    try {
      data = JSON.parse(dataLine.slice(6));
    } catch {
      return; // A block we cannot read is not a reason to drop the stream.
    }
    if (event === 'token') onToken?.(data.t);
    else if (event === 'done') onDone?.(data);
    else if (event === 'error') onError?.(data);
  };

  // SSE blocks are separated by a blank line, and a network chunk can end
  // mid-block — hold the tail until its terminator arrives.
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      handle(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
    }
  }
}
