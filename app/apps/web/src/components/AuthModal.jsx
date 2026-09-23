import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GoogleLogin } from '@react-oauth/google';
import { X } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { api, ApiError } from '../lib/api';

const EMPTY_FORM = { fullName: '', email: '', password: '' };
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

/**
 * Sign in / create account. Mounted once in App.jsx; opens itself whenever
 * AuthContext's `modalOpen` is true — call `useAuth().openAuthModal()` from
 * anywhere (Navbar's "Sign in" button does this) rather than rendering
 * another copy of this component.
 */
export default function AuthModal() {
  const { t } = useTranslation();
  const {
    modalOpen,
    closeAuthModal,
    login,
    signup,
    loginWithGoogle,
    pendingVerifyNotice,
    clearVerifyNotice,
  } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [verifySent, setVerifySent] = useState(false);
  const [resending, setResending] = useState(false);

  if (!modalOpen) return null;

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function switchMode(next) {
    setMode(next);
    setError('');
  }

  function handleClose() {
    closeAuthModal();
    setForm(EMPTY_FORM);
    setError('');
    setVerifySent(false);
    clearVerifyNotice?.();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
        handleClose();
      } else {
        await signup({ email: form.email, password: form.password, fullName: form.fullName });
        setVerifySent(true);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.genericError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSuccess(credentialResponse) {
    setError('');
    setBusy(true);
    try {
      if (!credentialResponse?.credential) {
        throw new Error('missing credential');
      }
      await loginWithGoogle(credentialResponse.credential);
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.genericError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError('');
    try {
      await api.resendVerification();
      setVerifySent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.genericError'));
    } finally {
      setResending(false);
    }
  }

  const inputClass =
    'w-full bg-transparent border border-bone/25 px-3 py-2.5 text-sm text-bone focus:outline-none focus:border-bone/60 transition';
  const labelClass = 'block text-xs uppercase tracking-wider text-bone/50 mb-2';
  const showVerify = verifySent || pendingVerifyNotice;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm bg-ink border border-bone/15 p-8 relative"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-bone/50 hover:text-bone transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {showVerify ? (
          <div className="space-y-4">
            <h2 className="font-display text-xl text-bone">{t('auth.verifyEmailTitle')}</h2>
            <p className="text-sm text-bone/70 leading-relaxed">{t('auth.verifyEmailNotice')}</p>
            {error && <p className="text-sm text-amber">{error}</p>}
            <button
              type="button"
              disabled={resending}
              onClick={handleResend}
              className="w-full border border-bone/25 hover:border-bone/50 disabled:opacity-50 text-bone py-3 text-sm uppercase tracking-wider transition"
            >
              {resending ? t('auth.pleaseWait') : t('auth.resendVerification')}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="w-full bg-kteh hover:bg-kteh-hover text-bone py-3 text-sm uppercase tracking-wider transition"
            >
              {t('auth.continueIntoApp')}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-6 text-sm mb-8 border-b border-bone/10">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`pb-3 -mb-px border-b-2 transition ${
                  mode === 'login' ? 'border-kteh text-bone' : 'border-transparent text-bone/50'
                }`}
              >
                {t('auth.signIn')}
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`pb-3 -mb-px border-b-2 transition ${
                  mode === 'signup' ? 'border-kteh text-bone' : 'border-transparent text-bone/50'
                }`}
              >
                {t('auth.createAccount')}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label htmlFor="fullName" className={labelClass}>{t('auth.fullName')}</label>
                  <input
                    id="fullName"
                    required
                    value={form.fullName}
                    onChange={update('fullName')}
                    className={inputClass}
                  />
                </div>
              )}
              <div>
                <label htmlFor="authEmail" className={labelClass}>{t('auth.email')}</label>
                <input
                  id="authEmail"
                  type="email"
                  required
                  value={form.email}
                  onChange={update('email')}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="authPassword" className={labelClass}>{t('auth.password')}</label>
                <input
                  id="authPassword"
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={update('password')}
                  className={inputClass}
                />
                {mode === 'signup' && (
                  <p className="mt-1.5 text-[11px] text-bone/40">{t('auth.passwordHint')}</p>
                )}
              </div>

              {error && <p className="text-sm text-amber">{error}</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full bg-kteh hover:bg-kteh-hover disabled:opacity-50 text-bone py-3 text-sm uppercase tracking-wider transition"
              >
                {busy ? t('auth.pleaseWait') : mode === 'login' ? t('auth.submitSignIn') : t('auth.submitCreateAccount')}
              </button>
            </form>

            {GOOGLE_CLIENT_ID ? (
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-bone/35">
                  <span className="flex-1 h-px bg-bone/15" />
                  {t('auth.or')}
                  <span className="flex-1 h-px bg-bone/15" />
                </div>
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError(t('auth.genericError'))}
                    theme="filled_black"
                    shape="rectangular"
                    text="continue_with"
                    width="320"
                  />
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
