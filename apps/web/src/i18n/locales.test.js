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

  it('covers the screens the community operates, not only the visitor-facing ones', () => {
    // Dashboard is where a household reads its own earnings; Review is the
    // Committee's console. Both were English-only while the landing page
    // and navbar were translated.
    for (const section of ['dashboard', 'review', 'nav', 'auth', 'landing']) {
      expect(Object.keys(vi[section] ?? {}).length).toBeGreaterThan(0);
    }
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
    const suspicious = [];
    const walk = (a, b, path = '') => {
      for (const [k, v] of Object.entries(a)) {
        if (v && typeof v === 'object') walk(v, b?.[k] ?? {}, `${path}${k}.`);
        else if (
          typeof v === 'string' &&
          v.length > 24 &&
          b?.[k] === v &&
          !identicalOnPurpose.includes(`${path}${k}`)
        ) {
          suspicious.push(`${path}${k}`);
        }
      }
    };
    walk(en, vi);
    expect(suspicious).toEqual([]);
  });
});
