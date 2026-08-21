import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, X, UserRound } from 'lucide-react';
import NotificationBell from './NotificationBell';
import { useAuth } from '../context/useAuth';

/**
 * Shared navigation bar.
 *
 * Props:
 *   active  — route key of the current page, e.g. "explore". Highlights that link.
 *   theme   — "dark" (default) or "light". Use "light" when the section
 *             directly beneath the navbar has the Bone cream background.
 */
export default function Navbar({ active = '', theme = 'dark' }) {
  const [open, setOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();
  const isDark = theme === 'dark';

  const LINKS = [
    { key: 'explore', label: t('nav.explore'), href: '#explore' },
    { key: 'travel', label: t('nav.travel'), href: '#travel' },
    { key: 'marketplace', label: t('nav.marketplace'), href: '#marketplace' },
    { key: 'assistant', label: t('nav.assistant'), href: '#assistant' },
    { key: 'carbon', label: t('nav.carbon'), href: '#carbon' },
    { key: 'community', label: t('nav.community'), href: '#community' },
  ];

  // Only surfaced to people who can act on it. The route itself is still
  // gated in Review.jsx and by the API — hiding a link is not access control.
  if (user?.provider || user?.role === 'COORDINATOR' || user?.role === 'ADMIN' || user?.isCommitteeMember) {
    LINKS.push({ key: 'dashboard', label: t('nav.dashboard'), href: '#dashboard' });
  }
  if (user?.isCommitteeMember || user?.role === 'ADMIN') {
    LINKS.push({ key: 'review', label: t('nav.review'), href: '#review' });
  }

  function toggleLanguage() {
    i18n.changeLanguage(i18n.resolvedLanguage === 'vi' ? 'en' : 'vi');
  }

  const bg = isDark ? 'bg-[#1A1614]' : 'bg-[#F5EDDD]';
  const text = isDark ? 'text-[#F5EDDD]' : 'text-[#1A1614]';
  const muted = isDark ? 'text-[#F5EDDD]/70' : 'text-[#1A1614]/70';
  const faint = isDark ? 'text-[#F5EDDD]/50' : 'text-[#1A1614]/50';
  const rule = isDark ? 'border-[#F5EDDD]/10' : 'border-[#1A1614]/10';
  const divider = isDark ? 'bg-[#F5EDDD]/20' : 'bg-[#1A1614]/20';
  const btnBorder = isDark
    ? 'border-[#F5EDDD]/30 hover:border-[#F5EDDD]/70'
    : 'border-[#1A1614]/30 hover:border-[#1A1614]/70';

  return (
    <header className={`${bg} ${text} border-b ${rule} sticky top-0 z-50`}>
      <nav className="px-8 lg:px-12 xl:px-16 py-3 flex items-center">

        {/* Wordmark */}
        <a href="#home" className="flex items-center gap-4 shrink-0">
          <span className="font-display text-2xl font-semibold tracking-tight">KNĂ</span>
          <span className={`hidden md:block h-4 w-px ${divider}`} />
          <span className={`hidden md:block text-[10px] ${faint} tracking-[0.2em] uppercase`}>
            {t('nav.wordmarkSub')}
          </span>
        </a>

        {/* Desktop links */}
        <div className="ml-auto hidden lg:flex items-center gap-8">
          <div className={`flex items-center gap-8 text-sm ${muted}`}>
            {LINKS.map((link) => {
              const isActive = link.key === active;
              return (
                <a
                  key={link.key}
                  href={link.href}
                  className={`relative transition ${
                    isActive ? (isDark ? 'text-[#F5EDDD]' : 'text-[#1A1614]') : ''
                  } ${isDark ? 'hover:text-[#F5EDDD]' : 'hover:text-[#1A1614]'}`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute -bottom-1 left-0 right-0 h-px bg-[#C8302E]" />
                  )}
                </a>
              );
            })}
          </div>

          <div className="flex items-center gap-5 text-sm">
            <button
              onClick={toggleLanguage}
              className={`${faint} text-xs tracking-wider hover:${text}`}
              aria-label="Switch language"
            >
              {t('nav.langToggle')}
            </button>
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                {/* The greeting is a greeting; the icon is the door. Making
                    the whole phrase a link meant the only route to an
                    account was a piece of text that did not look like one. */}
                <span className={`${muted} text-xs`}>
                  {t('auth.greeting', { name: user.fullName.split(' ')[0] })}
                </span>
                <NotificationBell theme={theme} />
                <a
                  href="#account"
                  aria-label={t('nav.account')}
                  title={t('nav.account')}
                  className={`inline-flex items-center justify-center w-8 h-8 border ${btnBorder} transition`}
                >
                  <UserRound className="w-4 h-4" />
                </a>
                <button
                  onClick={logout}
                  className={`px-4 py-2 border ${btnBorder} transition text-xs uppercase tracking-wider`}
                >
                  {t('auth.signOut')}
                </button>
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                className={`px-4 py-2 border ${btnBorder} transition text-xs uppercase tracking-wider`}
              >
                {t('nav.signIn')}
              </button>
            )}
          </div>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="ml-auto lg:hidden p-2"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className={`lg:hidden border-t ${rule} px-8 py-6`}>
          <div className="flex flex-col gap-5">
            {LINKS.map((link) => (
              <a
                key={link.key}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`text-base ${
                  link.key === active ? text : muted
                }`}
              >
                {link.label}
              </a>
            ))}
            <div className={`flex items-center gap-5 pt-4 border-t ${rule}`}>
              <button onClick={toggleLanguage} className={`${faint} text-xs tracking-wider`}>
                {t('nav.langToggle')}
              </button>
              {isAuthenticated ? (
                <>
                  <a
                    href="#account"
                    onClick={() => setOpen(false)}
                    className={`${faint} text-xs uppercase tracking-wider`}
                  >
                    {t('nav.account')}
                  </a>
                <button
                  onClick={logout}
                  className={`px-4 py-2 border ${btnBorder} transition text-xs uppercase tracking-wider`}
                >
                  {t('auth.signOut')}
                </button>
                </>
              ) : (
                <button
                  onClick={() => { setOpen(false); openAuthModal(); }}
                  className={`px-4 py-2 border ${btnBorder} transition text-xs uppercase tracking-wider`}
                >
                  {t('nav.signIn')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
