import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import vi from './locales/vi.json';

/**
 * The project's own argument is that a transparent system whose
 * beneficiaries cannot read it is not empowerment but only technical
 * transparency. The Vietnamese locale is what makes that true rather than
 * stated, so it is worth a test that fails when it drifts.
 *
 * The failure this guards against is quiet: an English key added without
 * its Vietnamese pair falls back to English at runtime, so the screen keeps
 * working and nobody notices until a household reads it.
 */

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  );

describe('locales', () => {
  const enKeys = flatten(en).sort();
  const viKeys = flatten(vi).sort();

  it('defines every English key in Vietnamese', () => {
    expect(enKeys.filter((k) => !viKeys.includes(k))).toEqual([]);
  });

  it('defines no Vietnamese key that English lacks', () => {
    expect(viKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
  });

  it('covers every screen, not just the visitor-facing ones', () => {
    // The landing page and navbar were translated long before anything
    // else, which made the app look bilingual while every actual feature
    // stayed in English. This is the list that stops that recurring: one
    // section per screen, all of them.
    const sections = [
      'nav', 'auth', 'landing',
      'explore', 'travel', 'marketplace', 'community', 'assistant', 'carbon',
      'dashboard', 'review',
      'demo', 'apiError', 'imageSlot',
    ];
    for (const section of sections) {
      expect(Object.keys(vi[section] ?? {}).length, `vi.${section} is missing`).toBeGreaterThan(0);
      expect(Object.keys(en[section] ?? {}).length, `en.${section} is missing`).toBeGreaterThan(0);
    }
  });

  it('keeps array-shaped content the same length in both languages', () => {
    // Several screens render arrays straight out of the locale files
    // (pillars, prompts, guardrails, offset projects). A short array in one
    // language silently drops cards from the page rather than erroring.
    const walk = (a, b, path = '') => {
      for (const [k, v] of Object.entries(a)) {
        const other = b?.[k];
        if (Array.isArray(v)) {
          expect(Array.isArray(other), `${path}${k} is not an array in vi`).toBe(true);
          expect(other.length, `${path}${k} length differs`).toBe(v.length);
        } else if (v && typeof v === 'object') {
          walk(v, other ?? {}, `${path}${k}.`);
        }
      }
    };
    walk(en, vi);
  });

  it('has no Vietnamese value left as its English original', () => {
    // A placeholder copied across is worse than a missing key: it looks
    // translated. Compares only strings long enough to be prose.
    //
    // Deliberate exceptions are listed rather than excluded by a looser
    // rule, so adding one is a decision somebody makes on purpose.
    const identicalOnPurpose = [
      // Proper nouns and a competition name; translating these would be wrong.
      'landing.footer.copyright',
    ];
    // Image paths sit beside the prose they belong to, so a translator
    // never has to hunt for a filename — but a filename is not prose and
    // is identical in every language by definition.
    const isAssetPath = (key, value) =>
      key.endsWith('.image') || (typeof value === 'string' && value.startsWith('/images/'));
    const suspicious = [];
    const walk = (a, b, path = '') => {
      for (const [k, v] of Object.entries(a)) {
        if (v && typeof v === 'object') walk(v, b?.[k] ?? {}, `${path}${k}.`);
        else if (
          typeof v === 'string' &&
          v.length > 24 &&
          b?.[k] === v &&
          !identicalOnPurpose.includes(`${path}${k}`) &&
          !isAssetPath(`${path}${k}`, v)
        ) {
          suspicious.push(`${path}${k}`);
        }
      }
    };
    walk(en, vi);
    expect(suspicious).toEqual([]);
  });
});
