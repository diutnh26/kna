import { describe, it, expect } from 'vitest';
import { ETHNICITIES, DEFAULT_SLUG, getEthnicity, isKnownSlug } from './index';

const LANGS = ['vi', 'en'];

/** Every { vi, en } pair must carry both, or one language renders blank. */
function expectBilingual(value, where) {
  expect(value, `${where} is missing`).toBeTruthy();
  for (const lang of LANGS) {
    expect(typeof value[lang], `${where}.${lang}`).toBe('string');
    expect(value[lang].length, `${where}.${lang} is empty`).toBeGreaterThan(0);
  }
}

describe('ethnicity profiles', () => {
  it('has a unique slug per profile and a valid default', () => {
    const slugs = ETHNICITIES.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(isKnownSlug(DEFAULT_SLUG)).toBe(true);
  });

  it('returns the default rather than undefined for an unknown slug', () => {
    expect(getEthnicity('nope').slug).toBe(DEFAULT_SLUG);
    expect(isKnownSlug('nope')).toBe(false);
  });

  it.each(ETHNICITIES.map((e) => [e.slug, e]))('%s is complete', (slug, profile) => {
    expectBilingual(profile.name, `${slug}.name`);
    expectBilingual(profile.region, `${slug}.region`);
    expectBilingual(profile.intro, `${slug}.intro`);
    expect(profile.endonym).toBeTruthy();
    expect(profile.coords).toHaveLength(2);
    expect(['community', 'research']).toContain(profile.provenance);

    // Three traditions is what the grid is built for; a fourth would fall
    // to a second row on its own.
    expect(profile.identity).toHaveLength(3);
    for (const item of profile.identity) {
      expectBilingual(item.title, `${slug}.identity.${item.key}.title`);
      expectBilingual(item.line, `${slug}.identity.${item.key}.line`);
      expectBilingual(item.body, `${slug}.identity.${item.key}.body`);
      expectBilingual(item.image.alt, `${slug}.identity.${item.key}.image.alt`);
      expect(item.native).toBeTruthy();
    }

    expect(profile.places.length).toBeGreaterThan(0);
    for (const place of profile.places) {
      expect(place.name).toBeTruthy();
      expect(place.province).toBeTruthy();
      expectBilingual(place.blurb, `${slug}.places.${place.name}.blurb`);
    }

    expect(profile.experiences.length).toBeGreaterThan(0);
    for (const item of profile.experiences) {
      expectBilingual(item.title, `${slug}.experiences.title`);
      expectBilingual(item.body, `${slug}.experiences.body`);
    }
  });

  // Every image is a Commons file under a free licence with a named author.
  // Publishing someone's photograph of a community without either is the
  // precise failure this platform exists to argue against.
  it.each(ETHNICITIES.map((e) => [e.slug, e]))('%s credits every photograph', (slug, profile) => {
    for (const item of profile.identity) {
      const { credit, src } = item.image;
      expect(src, `${slug}.${item.key}`).toMatch(
        /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//
      );
      expect(credit.author, `${slug}.${item.key} author`).toBeTruthy();
      expect(credit.license, `${slug}.${item.key} licence`).toMatch(/CC BY|Public domain/);
      expect(credit.source, `${slug}.${item.key} source`).toMatch(
        /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/
      );
      // Where a photograph is of the right people in the wrong place, the
      // caption has to say so in both languages.
      if (credit.note) expectBilingual(credit.note, `${slug}.${item.key} note`);
    }
  });

  it.each(ETHNICITIES.map((e) => [e.slug, e]))('%s phrases carry their etiquette', (slug, profile) => {
    for (const phrase of profile.phrases) {
      expect(phrase.native, `${slug} phrase native`).toBeTruthy();
      expect(phrase.vi).toBeTruthy();
      expect(phrase.en).toBeTruthy();
      expectBilingual(phrase.note, `${slug}.phrases.${phrase.native}.note`);
      if (phrase.etiquette) {
        expectBilingual(phrase.etiquette, `${slug}.phrases.${phrase.native}.etiquette`);
      }
    }
  });

  // Lô Lô deliberately ships with no phrases: the research carries none and
  // approximating them from a related language would be worse than the gap.
  // This asserts the empty state is reachable, so the screen that renders it
  // keeps being exercised.
  it('allows a profile with no phrases recorded', () => {
    expect(getEthnicity('lolo').phrases).toHaveLength(0);
  });

  // Only Ê Đê went through the Committee. If a second profile ever claims
  // 'community' it should be because a community actually reviewed it.
  it('claims community provenance for Ê Đê only', () => {
    const community = ETHNICITIES.filter((e) => e.provenance === 'community');
    expect(community.map((e) => e.slug)).toEqual(['ede']);
  });

  it('gives every profile a full accent palette', () => {
    for (const profile of ETHNICITIES) {
      for (const token of ['kteh', 'ktehHover', 'copper', 'amber', 'deep']) {
        expect(profile.theme[token], `${profile.slug}.theme.${token}`).toMatch(
          /^#[0-9a-fA-F]{6}$/
        );
      }
    }
  });
});
