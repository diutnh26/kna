import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ETHNICITIES } from '../content/ethnicities';
import { useEthnicity } from '../context/useEthnicity';

/**
 * The bar that moves between ethnicities.
 *
 * Sticky under the navbar so it stays reachable through a long page — the
 * reader who has scrolled to the phrasebook is exactly the reader most
 * likely to want to compare it against another people's.
 *
 * Keyboard handling follows the ARIA tablist pattern: arrows move and
 * select, Home and End jump to the ends. Tab moves past the whole bar
 * rather than through five buttons, which is why only the selected tab is
 * in the tab order.
 */
export default function EthnicitySwitcher({ theme = 'dark' }) {
  const { t, i18n } = useTranslation();
  const { slug, select } = useEthnicity();
  const isDark = theme === 'dark';
  const refs = useRef([]);
  const lang = i18n.resolvedLanguage === 'vi' ? 'vi' : 'en';

  /**
   * Pull the next profile's photographs before the reader asks for them.
   *
   * The largest source of jank in the switch is an ImageSlot flashing
   * empty mid-crossfade. Hover and focus both run about 200ms ahead of the
   * click, which is enough for a warm CDN. Decoding off the main thread
   * keeps the prefetch itself from causing the stutter it exists to avoid.
   */
  const prefetch = useCallback((profile) => {
    for (const item of profile.identity) {
      const img = new Image();
      img.src = item.image.src;
      if (img.decode) img.decode().catch(() => {});
    }
  }, []);

  const onKeyDown = (event) => {
    const index = ETHNICITIES.findIndex((e) => e.slug === slug);
    let next = null;
    if (event.key === 'ArrowRight') next = (index + 1) % ETHNICITIES.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + ETHNICITIES.length) % ETHNICITIES.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = ETHNICITIES.length - 1;
    if (next === null) return;

    event.preventDefault();
    select(ETHNICITIES[next].slug);
    refs.current[next]?.focus();
  };

  const bg = isDark ? 'bg-ink/95' : 'bg-bone/95';
  const rule = isDark ? 'border-bone/10' : 'border-ink/10';
  const idle = isDark
    ? 'border-bone/20 text-bone/60 hover:text-bone hover:border-bone/50'
    : 'border-ink/20 text-ink/60 hover:text-ink hover:border-ink/50';

  return (
    <div
      className={`${bg} border-b ${rule} sticky top-[57px] z-40 backdrop-blur`}
      data-testid="ethnicity-switcher"
    >
      <div className="px-8 lg:px-12 xl:px-16 py-3 flex items-center gap-6">
        <span
          className={`hidden md:block text-[10px] uppercase tracking-[0.25em] shrink-0 ${
            isDark ? 'text-bone/40' : 'text-ink/40'
          }`}
        >
          {t('ethnicity.label')}
        </span>

        {/* scroll-snap rather than a wrapped grid: five names do not fit on
            a phone, and a bar that reflows to two rows pushes the page
            content down every time the reader rotates the device. */}
        <div
          role="tablist"
          aria-label={t('ethnicity.label')}
          onKeyDown={onKeyDown}
          className="flex gap-2 overflow-x-auto snap-x snap-mandatory -mx-1 px-1 py-0.5 scrollbar-none"
        >
          {ETHNICITIES.map((profile, i) => {
            const active = profile.slug === slug;
            return (
              <button
                key={profile.slug}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => select(profile.slug)}
                onPointerEnter={() => prefetch(profile)}
                onFocus={() => prefetch(profile)}
                className={`snap-start shrink-0 px-4 py-1.5 text-xs uppercase tracking-wider border transition-colors duration-300 ${
                  active ? 'bg-kteh border-kteh text-bone' : idle
                }`}
              >
                {profile.name[lang]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
