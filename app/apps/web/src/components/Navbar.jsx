import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, X, UserRound } from 'lucide-react';
import NotificationBell from './NotificationBell';
import CartButton from './CartButton';
import { useAuth } from '../context/useAuth';
import WalletConnectButton from '../wallet/WalletConnect';

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
  // Review is the Committee's: publishing is their decision, and an admin
  // without a seat does not review.
  if (user?.isCommitteeMember) {
    LINKS.push({ key: 'review', label: t('nav.review'), href: '#review' });
  }
  if (user?.role === 'ADMIN') {
    LINKS.push({ key: 'admin', label: t('nav.admin'), href: '#admin' });
  }

  // Staff accounts carry extra links (Dashboard, Review, Admin) and a wallet
  // button. With all of them the desktop row no longer fits at lg widths,
  // so it switches to the menu until xl and tightens its spacing.
  const crowded = LINKS.length > 7;
  const desktopRow = crowded ? 'hidden xl:flex' : 'hidden lg:flex';
  const menuOnly = crowded ? 'xl:hidden' : 'lg:hidden';

  function toggleLanguage() {
    i18n.changeLanguage(i18n.resolvedLanguage === 'vi' ? 'en' : 'vi');
  }

  // Glass, not a solid bar. The navbar is the one element that sits over
  // content the whole way down the page, so it is the one place
  // translucency has something to be translucent against.
  const bg = isDark ? 'glass' : 'glass-light';
  const text = isDark ? 'text-bone' : 'text-ink';
  const muted = isDark ? 'text-bone/70' : 'text-ink/70';
  const faint = isDark ? 'text-bone/50' : 'text-ink/50';
  const rule = isDark ? 'border-bone/10' : 'border-ink/10';
  const divider = isDark ? 'bg-bone/20' : 'bg-ink/20';
  const btnBorder = isDark
    ? 'border-bone/30 hover:border-bone/70'
    : 'border-ink/30 hover:border-ink/70';

  return (
    <header className={`${bg} ${text} border-b ${rule} sticky top-0 z-50`}>
      <nav className="px-8 lg:px-12 xl:px-16 py-3 flex items-center">

        {/* Wordmark */}
        <a href="#home" className="flex items-center gap-4 shrink-0">
          <span className="font-display text-2xl font-semibold tracking-tight">KNĂ</span>
          <span className={`${crowded ? 'hidden 2xl:block' : 'hidden md:block'} h-4 w-px ${divider}`} />
          <span
            className={`${crowded ? 'hidden 2xl:block' : 'hidden md:block'} text-[10px] ${faint} tracking-[0.2em] uppercase whitespace-nowrap`}
          >
            {t('nav.wordmarkSub')}
          </span>
        </a>

        {/* Desktop links */}
        <div className={`ml-auto pl-6 ${desktopRow} items-center ${crowded ? 'gap-6' : 'gap-8'}`}>
          <div className={`flex items-center ${crowded ? 'gap-5' : 'gap-8'} text-sm whitespace-nowrap ${muted}`}>
            {LINKS.map((link) => {
              const isActive = link.key === active;
              return (
                <a
                  key={link.key}
                  href={link.href}
                  className={`relative transition ${
                    isActive ? (isDark ? 'text-bone' : 'text-ink') : ''
                  } ${isDark ? 'hover:text-bone' : 'hover:text-ink'}`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute -bottom-1 left-0 right-0 h-px bg-kteh" />
                  )}
                </a>
              );
            })}
          </div>

          <div className="flex items-center gap-5 text-sm">
            <button
              onClick={toggleLanguage}
              className={`${faint} text-xs tracking-wider whitespace-nowrap hover:${text}`}
              aria-label="Switch language"
            >
              {t('nav.langToggle')}
            </button>
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                {(user?.role === 'COORDINATOR' || user?.role === 'ADMIN' || user?.isCommitteeMember) && (
                  <WalletConnectButton />
                )}
                {/* The greeting is a greeting; the icon is the door. Making
                    the whole phrase a link meant the only route to an
                    account was a piece of text that did not look like one. */}
                <span className={`${muted} text-xs whitespace-nowrap`}>
                  {t('auth.greeting', { name: user.fullName.split(' ')[0] })}
                </span>
                <CartButton theme={theme} />
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
              /* The cart works signed out — a basket is only asked to
                 identify itself at checkout, which is where openAuthModal
                 is called from. Hiding it until sign-in would mean losing
                 whatever someone gathered on the way there. */
              <div className="flex items-center gap-3">
                <CartButton theme={theme} />
                <button
                  onClick={openAuthModal}
                  className={`px-4 py-2 border ${btnBorder} transition text-xs uppercase tracking-wider`}
                >
                  {t('nav.signIn')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen(!open)}
          className={`ml-auto ${menuOnly} p-2`}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className={`${menuOnly} border-t ${rule} px-8 py-6`}>
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
