import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { AuthContext } from './authContext';

/**
 * Session + auth-modal state for the whole app.
 *
 * Auth is cookie-based: the browser holds HttpOnly access/refresh cookies
 * and we only keep the `user` object in memory. No tokens in localStorage.
 *
 * A guest anywhere in the tree can call `openAuthModal()` (Navbar's
 * "Sign in" button does this); <AuthModal /> is mounted once in App.jsx.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingVerifyNotice, setPendingVerifyNotice] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user: me } = await api.me();
        if (!cancelled) setUser(me);
      } catch (err) {
        if (err?.status === 401) {
          try {
            const refreshed = await api.refresh();
            if (!cancelled) setUser(refreshed.user ?? null);
          } catch {
            if (!cancelled) setUser(null);
          }
        } else if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Soft email verify: if the account screen (or a pasted link) lands with
  // ?verify=… or #account?verify=…, consume it once.
  useEffect(() => {
    if (!ready) return;
    const hash = window.location.hash || '';
    const qs = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : window.location.search.slice(1);
    const params = new URLSearchParams(qs);
    const token = params.get('verify');
    if (!token) return;

    let cancelled = false;
    api
      .verifyEmail(token)
      .then(({ user: me }) => {
        if (!cancelled && me) setUser(me);
      })
      .catch(() => {
        /* leave a toast-less failure — Account can surface it later */
      })
      .finally(() => {
        // Strip the token from the URL so a refresh doesn't re-consume it.
        if (hash.startsWith('#account')) {
          window.history.replaceState(null, '', '#account');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const login = useCallback(async (email, password) => {
    const data = await api.login({ email, password });
    setUser(data.user);
    setPendingVerifyNotice(false);
    return data;
  }, []);

  const signup = useCallback(async (payload) => {
    const data = await api.signup(payload);
    setUser(data.user);
    setPendingVerifyNotice(true);
    return data;
  }, []);

  const loginWithGoogle = useCallback(async (idToken) => {
    const data = await api.googleLogin(idToken);
    setUser(data.user);
    setPendingVerifyNotice(false);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* still clear local state */
    }
    setUser(null);
    setPendingVerifyNotice(false);
  }, []);

  const refreshUser = useCallback(async () => {
    const { user: me } = await api.me();
    setUser(me);
    return me;
  }, []);

  /**
   * Kept for call-site compatibility (Account.jsx used to swap a JWT after
   * password change). Cookies are already rotated by the API; this is a
   * no-op that just refreshes the in-memory user.
   */
  const setToken = useCallback(() => {
    refreshUser().catch(() => {});
  }, [refreshUser]);

  const value = useMemo(
    () => ({
      user,
      // Sentinel so existing `if (!token)` / `api.foo(token)` call sites keep
      // working — cookies carry the real credential.
      token: user ? 'session' : null,
      isAuthenticated: Boolean(user),
      ready,
      pendingVerifyNotice,
      clearVerifyNotice: () => setPendingVerifyNotice(false),
      login,
      signup,
      loginWithGoogle,
      logout,
      refreshUser,
      setToken,
      modalOpen,
      openAuthModal: () => setModalOpen(true),
      closeAuthModal: () => setModalOpen(false),
    }),
    [
      user,
      ready,
      pendingVerifyNotice,
      login,
      signup,
      loginWithGoogle,
      logout,
      refreshUser,
      setToken,
      modalOpen,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
