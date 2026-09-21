import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { EthnicityContext } from './ethnicityContext';
import { DEFAULT_SLUG, getEthnicity, isKnownSlug } from '../content/ethnicities';
import { slugFromHash, writeHash } from '../lib/ethnicityHash';

const STORAGE_KEY = 'kna.ethnicity';

function readStored() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && isKnownSlug(stored) ? stored : null;
  } catch {
    // Private browsing, blocked site data. Not a failure — just no memory.
    return null;
  }
}

/**
 * Which ethnicity the reader is looking at.
 *
 * Above the router rather than inside Explore, so that moving from the
 * archive to the experiences does not silently reset the reader to Ê Đê.
 *
 * Precedence on first load is URL, then localStorage, then the default. A
 * shared link has to open on the profile it was sent for, whatever the
 * recipient last looked at.
 */
export function EthnicityProvider({ children }) {
  const [slug, setSlug] = useState(() => slugFromHash() ?? readStored() ?? DEFAULT_SLUG);

  // Bumped on every switch. Anything keyed on it remounts, which is what
  // drives the CSS fallback animation where View Transitions are missing.
  const [generation, setGeneration] = useState(0);
  const pending = useRef(false);

  // Back/forward, or a link into a specific profile from elsewhere.
  useEffect(() => {
    const onHashChange = () => {
      const fromUrl = slugFromHash();
      if (fromUrl) setSlug(fromUrl);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, slug);
    } catch {
      // See readStored.
    }
  }, [slug]);

  // The accent properties live on <html>, above everything React renders,
  // so the switch reaches the scrollbar and any portalled overlay too.
  useEffect(() => {
    const theme = getEthnicity(slug).theme;
    const root = document.documentElement;
    root.dataset.ethnicity = slug;
    root.style.setProperty('--c-kteh', theme.kteh);
    root.style.setProperty('--c-kteh-hover', theme.ktehHover);
    root.style.setProperty('--c-copper', theme.copper);
    root.style.setProperty('--c-amber', theme.amber);
    root.style.setProperty('--c-deep', theme.deep);
  }, [slug]);

  const select = useCallback(
    (next) => {
      if (next === slug || !isKnownSlug(next) || pending.current) return;

      const apply = () => {
        setSlug(next);
        setGeneration((g) => g + 1);
        writeHash(next);
      };

      const reduced =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (reduced || typeof document.startViewTransition !== 'function') {
        apply();
        return;
      }

      // startViewTransition snapshots the DOM the moment its callback
      // returns. React's setState is asynchronous, so without flushSync the
      // snapshot is taken before the re-render and the browser crossfades a
      // frame against itself — no movement at all, which reads as the
      // feature being broken rather than absent.
      pending.current = true;
      const transition = document.startViewTransition(() => flushSync(apply));
      transition.finished.finally(() => {
        pending.current = false;
      });
    },
    [slug],
  );

  const value = useMemo(
    () => ({
      slug,
      ethnicity: getEthnicity(slug),
      generation,
      select,
    }),
    [slug, generation, select],
  );

  return <EthnicityContext.Provider value={value}>{children}</EthnicityContext.Provider>;
}
