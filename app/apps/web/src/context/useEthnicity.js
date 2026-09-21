import { useContext } from 'react';
import { EthnicityContext } from './ethnicityContext';
import { DEFAULT_SLUG, getEthnicity } from '../content/ethnicities';

/**
 * The current ethnicity, and how to change it.
 *
 * Returns a working default outside a provider rather than throwing, so a
 * component test can render a single screen without wrapping it. `select`
 * is a no-op there, which is the honest behaviour: there is nothing to
 * switch.
 */
export function useEthnicity() {
  const ctx = useContext(EthnicityContext);
  if (ctx) return ctx;
  return {
    slug: DEFAULT_SLUG,
    ethnicity: getEthnicity(DEFAULT_SLUG),
    generation: 0,
    select: () => {},
  };
}
