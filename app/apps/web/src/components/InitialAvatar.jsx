/**
 * Stands in for a portrait that does not exist yet.
 *
 * The Committee roster names six people and gives each a seat and a buôn.
 * Until they have been photographed and have agreed to it, something has
 * to occupy that square — and the two obvious options are both bad. An
 * empty dashed box reads as broken on a page arguing these are real named
 * people. A generated face is worse: it would be a synthetic photograph of
 * an Ê Đê elder, indistinguishable from a real one once screenshotted out
 * of the demonstration banner's reach.
 *
 * So this is deliberately not a picture of anybody: initials on a woven
 * band drawn from the platform's own palette. It reads as a considered
 * placeholder rather than a missing asset, and nobody can mistake it for
 * documentation of a person.
 *
 * Replace with a real photograph — via Provider.imageUrl — the moment one
 * exists and its subject has agreed.
 */

// Kteh red, Gong copper, Brass, Forest, Earth. Drawn from the same palette
// as the rest of the design system rather than invented here.
const INKS = ['#6B1A1A', '#B87333', '#8A6A1F', '#4F5D3A', '#7A4A2E'];

/** Stable per name, so a member keeps the same colour across renders. */
function pick(name) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return INKS[h % INKS.length];
}

/**
 * First letter of the first and last name parts. Ê Đê names carry
 * diacritics that must survive — H'Bia, Y Wik, Aduôn — so this slices
 * characters rather than normalising them away.
 */
function initials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return parts[0][0] + parts[parts.length - 1][0];
}

export default function InitialAvatar({ name = '', className = '', ratio = 'aspect-square' }) {
  const ink = pick(name);
  const mark = initials(name);

  return (
    <div
      className={`${ratio} ${className} relative overflow-hidden flex items-center justify-center`}
      style={{ backgroundColor: ink }}
      // Decorative: the person's name is already rendered beside this, so
      // announcing initials again would only repeat it.
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, transparent 0 6px, rgba(245,237,221,.55) 6px 8px),' +
            'repeating-linear-gradient(45deg, transparent 0 10px, rgba(245,237,221,.3) 10px 11px)',
        }}
      />
      <span
        className="relative font-display font-medium text-bone leading-none"
        style={{ fontSize: '38%' }}
      >
        {mark}
      </span>
    </div>
  );
}
