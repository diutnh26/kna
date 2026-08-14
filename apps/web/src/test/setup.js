import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

// jsdom implements neither of these, and components use both.
window.scrollTo = vi.fn();

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
}

// No test may touch the network. Without this, a test's behaviour depends on
// whether a dev server happens to be running on :4000 — which is exactly how
// the first version of these tests failed: AuthProvider's mount-time
// `api.me()` reached a live server, got a 401 for its fake token, and
// silently signed the test user out.
vi.stubGlobal('fetch', (input) => {
  const url = typeof input === 'string' ? input : input?.url;
  return Promise.reject(
    new Error(
      `Unmocked network call to ${url}. Tests must not hit the network — ` +
        `mock the relevant api.* method with vi.spyOn.`
    )
  );
});
