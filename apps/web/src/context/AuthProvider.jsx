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

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAuthenticated: Boolean(session?.token),
      login,
      signup,
      logout,
      modalOpen,
      openAuthModal: () => setModalOpen(true),
      closeAuthModal: () => setModalOpen(false),
    }),
    [session, login, signup, logout, modalOpen]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
