import { useEffect, useRef, useState } from 'react';

/**
 * A measured figure arriving.
 *
 * Runs the digits through random values for a moment, then lands on the
 * real one. Used on the headline statistics, where the number is the
 * point of the block and a figure that simply appears is easy to scroll
 * past.
 *
 * Deliberately not used on anything a person is steering — a cart total
 * that scrambles while you press + reads as a bug, not as polish. Those
 * stay still and change in one step.
 *
 * Three things keep the scramble from being annoying:
 *
 *   - It runs once per value. A re-render for any other reason leaves the
 *     figure alone, so the statistics do not re-roll every time a filter
 *     changes elsewhere on the page.
 *   - Every frame holds the final digit count, so nothing around it moves.
 *     Paired with tabular-nums at the call site, the width is fixed too.
 *   - prefers-reduced-motion skips straight to the value. The figure is
 *     information; the roll is decoration.
 */
export default function AnimatedNumber({
  value,
  duration = 900,
  format = (n) => String(n),
  className = '',
  placeholder = '—',
}) {
  const [display, setDisplay] = useState(null);
  const [settling, setSettling] = useState(false);
  const played = useRef(null);
  const frame = useRef(0);

  // Read once, on first render. Resolving this during render rather than
  // inside the effect keeps the reduced-motion path off state entirely:
  // there is nothing to animate, so there is nothing to store.
  const [reduced] = useState(
    () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  const hasValue = value !== null && value !== undefined && Number.isFinite(value);
  const skip = reduced || duration <= 0;

  useEffect(() => {
    // Nothing to count to yet — the API has not answered.
    if (!hasValue || skip) return undefined;

    // Already rolled to this figure. Re-rendering is not a new arrival.
    if (played.current === value) return undefined;
    played.current = value;

    const digits = Math.max(1, String(Math.floor(Math.abs(value))).length);
    const floor = digits > 1 ? 10 ** (digits - 1) : 0;
    const ceiling = 10 ** digits;

    const start = performance.now();
    setSettling(true);

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);

      if (progress >= 1) {
        setDisplay(value);
        setSettling(false);
        return;
      }

      // Random early, converging late. A pure random walk for the whole
      // duration lands abruptly; easing the random range toward the true
      // value makes the last few frames read as the number settling onto
      // itself rather than as a cut.
      const eased = 1 - (1 - progress) ** 3;
      const spread = Math.round((ceiling - floor) * (1 - eased));
      const noise = spread > 0 ? Math.round((Math.random() - 0.5) * spread) : 0;
      const candidate = value + noise;

      // Keep the digit count steady so the layout never jumps mid-roll.
      setDisplay(Math.max(floor, Math.min(ceiling - 1, candidate)));

      frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration, hasValue, skip]);

  // With motion off the value is shown the moment it exists, straight from
  // the prop. No roll, no intermediate state.
  const shown = skip ? (hasValue ? value : null) : display;

  if (shown === null) {
    return <span className={className}>{placeholder}</span>;
  }

  const rolling = settling && !skip;

  return (
    <span className={`${className} ${rolling ? 'tallying' : ''}`.trim()}>
      {/* The figure is announced only once it is real. Without this a
          screen reader reads out every random frame. */}
      <span aria-hidden={rolling ? 'true' : undefined}>{format(shown)}</span>
      {rolling && <span className="sr-only">{format(value)}</span>}
    </span>
  );
}
