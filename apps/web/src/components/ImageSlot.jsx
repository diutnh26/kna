import { useState } from 'react';
import { Image } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * A photograph, or a labelled placeholder standing in for one.
 *
 * Both states live in one component on purpose. Photographs arrive a few at
 * a time — a household sends one, the Committee clears it — so every screen
 * has to render a mix of "photographed" and "not yet" for a long while, and
 * a missing photo is a normal state rather than a broken one.
 *
 * Props:
 *   src    — the photograph. Omit (or pass null) for the placeholder.
 *   label  — what the picture in this slot should show. Drawn as the
 *            placeholder caption, and used as alt text when no better
 *            description exists.
 *   alt    — what the photograph actually shows. Separate from `label`
 *            because they answer different questions: a caption saying
 *            "documentary photograph, vertical crop" tells a sighted
 *            reader what is still missing, and tells a screen-reader user
 *            nothing at all about the picture that is now there.
 *   ratio  — Tailwind aspect class, e.g. "aspect-[4/3]". Omit when the
 *            parent controls height (then pass className="h-full").
 *   theme  — "dark" (default) or "light", matched to the section background.
 *   showCaption — set false for thumbnails. The label is still the alt
 *            text, but it is not drawn: at 80px it is unreadable anyway,
 *            and in a list it repeats the heading sitting beside it.
 */
export default function ImageSlot({
  src,
  label,
  alt,
  ratio = 'aspect-[4/3]',
  theme = 'dark',
  showCaption = true,
  className = '',
}) {
  const { t } = useTranslation();
  // A src that 404s falls back to the placeholder rather than showing the
  // browser's broken-image glyph, which looks like a bug rather than a gap.
  const [failed, setFailed] = useState(false);
  const isDark = theme === 'dark';
  const caption = label ?? t('imageSlot.fallback');

  if (src && !failed) {
    return (
      <div className={`${ratio} overflow-hidden ${className}`}>
        <img
          src={src}
          alt={alt ?? caption}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  const border = isDark ? 'border-[#F5EDDD]/20' : 'border-[#1A1614]/20';
  const fill = isDark ? 'bg-[#F5EDDD]/[0.04]' : 'bg-[#1A1614]/[0.04]';
  const icon = isDark ? 'text-[#F5EDDD]/30' : 'text-[#1A1614]/30';
  const text = isDark ? 'text-[#F5EDDD]/40' : 'text-[#1A1614]/40';

  return (
    <div
      className={`${ratio} ${fill} border border-dashed ${border} flex flex-col items-center justify-center gap-3 p-6 ${className}`}
    >
      <Image className={`w-5 h-5 ${icon}`} strokeWidth={1.5} />
      {showCaption && (
        <p className={`text-xs ${text} text-center leading-relaxed max-w-[22ch]`}>{caption}</p>
      )}
    </div>
  );
}
