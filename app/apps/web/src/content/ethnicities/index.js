import ede from './ede';
import tay from './tay';
import lolo from './lolo';
import hmong from './hmong';
import khmer from './khmer';

/**
 * The ethnicity profiles, in the order the switcher shows them.
 *
 * Ê Đê leads because it is the one the platform was built with and the
 * only one carrying `provenance: 'community'`; the rest follow roughly
 * north to south. Order is editorial, so it lives here rather than being
 * derived from the slugs.
 *
 * Shape note: this array is what an `/api/ethnicities` endpoint would
 * return if this content moves into the database later. Keeping it to a
 * serialisable shape now means that move is a fetch call, not a rewrite.
 */
export const ETHNICITIES = [ede, tay, lolo, hmong, khmer];

export const DEFAULT_SLUG = 'ede';

const BY_SLUG = Object.fromEntries(ETHNICITIES.map((e) => [e.slug, e]));

/** Look up a profile, falling back to the default rather than returning undefined. */
export function getEthnicity(slug) {
  return BY_SLUG[slug] ?? BY_SLUG[DEFAULT_SLUG];
}

export function isKnownSlug(slug) {
  return Object.hasOwn(BY_SLUG, slug);
}

/**
 * Greetings from groups the report covers in its language section but not
 * as tourism models — there is no village, no set of experiences and no
 * photography behind them, so they are not tabs.
 *
 * They sit under the phrasebook as an appendix, which is the honest place
 * for a line of language with no place attached to it.
 */
export const ADDITIONAL_PHRASES = [
  {
    people: { vi: 'Thái', en: 'Thái' },
    region: { vi: 'Tây Bắc', en: 'The North-West' },
    native: 'Ải êm ơi! Bươm chiêng pi mấi…',
    vi: 'Bố mẹ ơi! Tháng tết năm mới…',
    en: 'Father, mother! The new year month…',
    note: {
      vi: 'Lối chào mang đậm tính văn chương: câu chào kéo dài, lồng lời chúc tụng và so sánh với sự vật thiên nhiên để làm tăng thể diện người đối diện.',
      en: 'A literary way of greeting: the line runs long, folding in good wishes and comparisons drawn from nature to raise the standing of the person addressed.',
    },
  },
  {
    people: { vi: 'Dao', en: 'Dao' },
    region: null,
    native: 'A cỏ nằng kháa mấy',
    vi: 'Xin chào',
    en: 'Hello',
    note: {
      vi: 'Lời chào thân mật, thường được cán bộ địa phương và du khách am hiểu văn hoá dùng để xoá rào cản tâm lý với đồng bào Dao.',
      en: 'A warm greeting, used by local officials and by visitors who know the culture to get past the first reserve.',
    },
  },
];
