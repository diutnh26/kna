import { Children } from 'react';

/**
 * A row that scrolls itself, endlessly.
 *
 * The children are rendered twice into one flex track, which the CSS
 * translates by exactly -50%. When the first copy has left the frame the
 * second is standing where it began, so the loop has no seam and no
 * JavaScript — no rAF, no scroll handler, nothing on the main thread.
 *
 * `speed` is pixels per second rather than a duration, so a row of three
 * traditions and a row of ten both drift at the same pace. Duration is
 * derived from it and the item count; setting a duration directly would
 * make a long row sprint.
 *
 * The duplicate is aria-hidden and inert. Without that, a screen reader
 * reads every tradition twice and the tab order runs through a set of
 * cards that are, as far as the reader is concerned, the same cards again.
 */
export default function Marquee({
  children,
  speed = 28,
  itemWidth = 380,
  gap = 32,
  className = '',
  label,
}) {
  const items = Children.toArray(children);
  if (items.length === 0) return null;

  // One full cycle covers one copy of the set.
  const distance = items.length * (itemWidth + gap);
  const duration = Math.max(20, Math.round(distance / speed));

  const copy = (hidden) =>
    items.map((child, i) => (
      <div
        key={`${hidden ? 'b' : 'a'}-${i}`}
        className="shrink-0"
        style={{ width: itemWidth, marginRight: gap }}
        {...(hidden ? { 'aria-hidden': 'true', inert: '' } : {})}
      >
        {child}
      </div>
    ));

  return (
    <div
      className={`marquee ${className}`}
      style={{ '--marquee-duration': `${duration}s` }}
      role="group"
      aria-label={label}
    >
      <div className="marquee-track">
        {copy(false)}
        {copy(true)}
      </div>
    </div>
  );
}
