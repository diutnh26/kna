import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { ApiError } from '../lib/api';

const EMPTY_FORM = { fullName: '', email: '', password: '' };

/**
 * Sign in / create account. Mounted once in App.jsx; opens itself whenever
 * AuthContext's `modalOpen` is true — call `useAuth().openAuthModal()` from
 * anywhere (Navbar's "Sign in" button does this) rather than rendering
 * another copy of this component.
 */
export default function AuthModal() {
  const { t } = useTranslation();
  const { modalOpen, closeAuthModal, login, signup } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await signup({ email: form.email, password: form.password, fullName: form.fullName });
      }
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.genericError'));
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'w-full bg-transparent border border-[#F5EDDD]/25 px-3 py-2.5 text-sm text-[#F5EDDD] focus:outline-none focus:border-[#F5EDDD]/60 transition';
  const labelClass = 'block text-xs uppercase tracking-wider text-[#F5EDDD]/50 mb-2';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm bg-[#1A1614] border border-[#F5EDDD]/15 p-8 relative"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-[#F5EDDD]/50 hover:text-[#F5EDDD] transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-6 text-sm mb-8 border-b border-[#F5EDDD]/10">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`pb-3 -mb-px border-b-2 transition ${
              mode === 'login' ? 'border-[#C8302E] text-[#F5EDDD]' : 'border-transparent text-[#F5EDDD]/50'
            }`}
          >
            {t('auth.signIn')}
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`pb-3 -mb-px border-b-2 transition ${
              mode === 'signup' ? 'border-[#C8302E] text-[#F5EDDD]' : 'border-transparent text-[#F5EDDD]/50'
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
          </div>

          {error && <p className="text-sm text-[#E8A33D]">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-[#C8302E] hover:bg-[#A82826] disabled:opacity-50 text-[#F5EDDD] py-3 text-sm uppercase tracking-wider transition"
          >
            {busy ? t('auth.pleaseWait') : mode === 'login' ? t('auth.submitSignIn') : t('auth.submitCreateAccount')}
          </button>
        </form>
      </div>
    </div>
  );
}
