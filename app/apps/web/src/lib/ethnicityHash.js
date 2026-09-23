import { DEFAULT_SLUG, isKnownSlug } from '../content/ethnicities';

/**
 * The ethnicity carried in the URL, as `#explore?e=tay`.
 *
 * Kept out of EthnicityProvider so that file exports a component and
 * nothing else — a module that exports both loses Fast Refresh, and every
 * consumer of the context unmounts on each edit.
 *
 * An unknown slug returns null rather than itself: a stale or mistyped link
 * should open the default profile, not a blank screen.
 */
export function slugFromHash(hash = window.location.hash) {
  const query = hash.split('?')[1];
  if (!query) return null;
  const slug = new URLSearchParams(query).get('e');
  return slug && isKnownSlug(slug) ? slug : null;
}

/**
 * Write the choice back into the hash without adding a history entry.
 *
 * replaceState rather than pushState: moving between five profiles is
 * reading, not navigating, and pushing would leave Back walking through
 * every tab the reader tried instead of leaving the page.
 *
 * The default slug is left out of the URL entirely, so the canonical link
 * to Explore stays `#explore`.
 */
export function writeHash(slug) {
  const [path = ''] = window.location.hash.split('?');

  if (slug === DEFAULT_SLUG) {
    window.history.replaceState(null, '', path || window.location.pathname);
    return;
  }

  // On the landing page there is no hash to append to, and `'' + '?e=tay'`
  // is a query string, not a fragment — the parameter would land in
  // location.search where slugFromHash never looks, and the choice would be
  // lost on the next reload. Anchoring to #home, which routes to Landing
  // exactly as the empty hash does, keeps it in the fragment.
  const base = path || '#home';
  window.history.replaceState(null, '', `${base}?e=${slug}`);
}
