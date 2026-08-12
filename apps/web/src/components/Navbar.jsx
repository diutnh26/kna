import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, X } from 'lucide-react';

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
  const isDark = theme === 'dark';

  const LINKS = [
    { key: 'explore', label: t('nav.explore'), href: '#explore' },
    { key: 'travel', label: t('nav.travel'), href: '#travel' },
    { key: 'marketplace', label: t('nav.marketplace'), href: '#marketplace' },
    { key: 'assistant', label: t('nav.assistant'), href: '#assistant' },
    { key: 'impact', label: t('nav.impact'), href: '#impact' },
    { key: 'community', label: t('nav.community'), href: '#community' },
  ];

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
            <button
              className={`px-4 py-2 border ${btnBorder} transition text-xs uppercase tracking-wider`}
            >
              {t('nav.signIn')}
            </button>
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
              <button
                className={`px-4 py-2 border ${btnBorder} transition text-xs uppercase tracking-wider`}
              >
                {t('nav.signIn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
