import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { AuthContext } from './authContext';

const STORAGE_KEY = 'kna-auth';

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Session + auth-modal state for the whole app. A guest anywhere in the
 * tree can call `openAuthModal()` (Navbar's "Sign in" button does this);
 * <AuthModal /> is mounted once in App.jsx and reads `modalOpen` from here.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  }, [session]);

  // A session restored from localStorage carries whatever the user looked
  // like when the token was issued. Re-read it once on mount so a seat
  // granted or withdrawn since then is reflected, and so a revoked or
  // expired token signs the person out instead of leaving a stale UI.
  useEffect(() => {
    const storedToken = readStoredSession()?.token;
    if (!storedToken) return;
    let cancelled = false;
    api
      .me(storedToken)
      .then(({ user }) => {
        if (!cancelled) setSession((s) => (s ? { ...s, user } : s));
      })
      .catch((err) => {
        if (!cancelled && err?.status === 401) setSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login({ email, password });
    setSession(data);
    return data;
  }, []);

  const signup = useCallback(async (payload) => {
    const data = await api.signup(payload);
    setSession(data);
    return data;
  }, []);

  const logout = useCallback(() => setSession(null), []);

  /**
   * Re-reads the signed-in person from the API.
   *
   * The session in localStorage is a snapshot from when the token was
   * issued. After the account screen changes a name or a language, the
   * navbar greeting and the language toggle are both reading that stale
   * snapshot until this runs.
   */
  const refreshUser = useCallback(async () => {
    const current = readStoredSession()?.token;
    if (!current) return;
    const { user } = await api.me(current);
    setSession((s) => (s ? { ...s, user } : s));
  }, []);

  /**
   * Replaces the token without touching the user.
   *
   * Changing a password revokes every token including this tab's, and the
   * API hands back a replacement. Without this the person would be signed
   * out of the page they just changed their password on, which reads as
   * the change having failed.
   */
  const setToken = useCallback((token) => {
    setSession((s) => (s ? { ...s, token } : s));
  }, []);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAuthenticated: Boolean(session?.token),
      login,
      signup,
      logout,
      refreshUser,
      setToken,
      modalOpen,
      openAuthModal: () => setModalOpen(true),
      closeAuthModal: () => setModalOpen(false),
    }),
    [session, login, signup, logout, refreshUser, setToken, modalOpen]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
