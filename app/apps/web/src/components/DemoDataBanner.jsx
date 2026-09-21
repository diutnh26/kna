import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { api } from '../lib/api';

/**
 * Says plainly that the figures on screen are demonstration material.
 *
 * This platform's entire argument is that its ledger can be trusted. A
 * demonstration environment showing fabricated revenue splits with nothing
 * marking them as such would undermine that argument in exactly the place
 * it is being made — so the honest thing is to say so on every screen, not
 * in a README nobody opens.
 *
 * Whether to show it comes from the API (`isDemoData`), which derives it
 * from whether any @example.kna accounts exist. Deliberately not a build
 * flag: a flag left set would label real pilot records as a demo, and a
 * flag left unset would present demo figures as real. This clears itself
 * the moment the demonstration records are removed.
 */
export default function DemoDataBanner() {
  const { t } = useTranslation();
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .communityStats()
      .then((stats) => {
        if (!cancelled) setIsDemo(Boolean(stats?.isDemoData));
      })
      // Silent: an unreachable API already surfaces on the screen itself,
      // and a second error message about the banner helps nobody.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isDemo) return null;

  return (
    <div
      role="status"
      className="bg-copper text-ink px-8 lg:px-12 xl:px-16 py-2.5 text-sm flex items-start gap-2.5"
    >
      <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      <p className="leading-snug">
        <strong className="font-semibold">{t('demo.label')}</strong> {t('demo.body')}
      </p>
    </div>
  );
}
