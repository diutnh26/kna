/**
 * Photographs, and where they came from.
 *
 * Every image in the ethnicity profiles is hosted by Wikimedia Commons and
 * carries a free licence (CC BY, CC BY-SA, or public domain). Nothing here
 * is hotlinked from a blog or a tour operator: those break, and this
 * platform's whole claim is that its records are traceable.
 *
 * `Special:FilePath` resolves a file name to the current file without the
 * MD5-hashed directory prefix that upload.wikimedia.org URLs carry. That
 * prefix is easy to get wrong and impossible to read, and a wrong one is a
 * silent 404. This form is stable and legible.
 *
 * `note` on a credit is the important field. Several of these photographs
 * are of the right people in the wrong place — a Tày village in Bắc Kạn
 * standing in for one in Lào Cai, a longhouse in a Hanoi museum standing in
 * for one in Đắk Lắk. That is a caption, not a secret. Anything with a note
 * is a placeholder waiting for a photograph from the community itself.
 */

const COMMONS = 'https://commons.wikimedia.org/wiki/Special:FilePath/';

/** Direct URL to a Commons file, scaled server-side to `width`. */
export function commons(file, width = 1400) {
  return `${COMMONS}${encodeURIComponent(file.replace(/ /g, '_'))}?width=${width}`;
}

/** Link to the file's description page, where the licence and author live. */
export function commonsPage(file) {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`;
}

/**
 * Build an image record.
 *
 * @param file    Commons file name, spaces and diacritics as written there.
 * @param alt     { vi, en } — what is in the frame, for a screen reader.
 * @param credit  { author, license, note? } — note when the photograph is
 *                not from the place the surrounding text describes.
 */
export function photo(file, alt, credit) {
  return {
    src: commons(file),
    thumb: commons(file, 700),
    alt,
    credit: { ...credit, file, source: commonsPage(file) },
  };
}
