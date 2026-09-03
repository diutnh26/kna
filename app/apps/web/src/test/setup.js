import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

// jsdom implements none of these, and components use all of them.
window.scrollTo = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

// InteractiveMap watches its own container so Leaflet can re-measure after
// the grid column settles. jsdom has no ResizeObserver, and the map is
// lazy-loaded, so whether a test reached that line depended on whether the
// chunk resolved before the test ended. That is why CI failed on some pushes
// and passed on others with the same code, while a local run passed every
// time. Stubbed rather than guarded in the component: every browser it will
// actually run in has this, and jsdom is the incomplete environment here.
if (!window.ResizeObserver) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverStub;
  globalThis.ResizeObserver = ResizeObserverStub;
}

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
