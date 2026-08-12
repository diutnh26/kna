import { Image } from 'lucide-react';

/**
 * Placeholder for a photograph that has not been sourced yet.
 *
 * Props:
 *   label  — what the final image should show, e.g. "Cồng Chiêng performance at dusk"
 *   ratio  — Tailwind aspect class, e.g. "aspect-[4/3]". Omit when the parent
 *            controls height (then pass className="h-full").
 *   theme  — "dark" (default) or "light", matched to the section background.
 *   className — extra classes passed through to the wrapper.
 */
export default function ImageSlot({
  label = 'Image',
  ratio = 'aspect-[4/3]',
  theme = 'dark',
  className = '',
}) {
  const isDark = theme === 'dark';

  const border = isDark ? 'border-[#F5EDDD]/20' : 'border-[#1A1614]/20';
  const fill = isDark ? 'bg-[#F5EDDD]/[0.04]' : 'bg-[#1A1614]/[0.04]';
  const icon = isDark ? 'text-[#F5EDDD]/30' : 'text-[#1A1614]/30';
  const text = isDark ? 'text-[#F5EDDD]/40' : 'text-[#1A1614]/40';

  return (
    <div
      className={`${ratio} ${fill} border border-dashed ${border} flex flex-col items-center justify-center gap-3 p-6 ${className}`}
    >
      <Image className={`w-5 h-5 ${icon}`} strokeWidth={1.5} />
      <p className={`text-xs ${text} text-center leading-relaxed max-w-[22ch]`}>
        {label}
      </p>
    </div>
  );
}
