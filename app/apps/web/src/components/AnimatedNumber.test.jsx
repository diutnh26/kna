import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AnimatedNumber from './AnimatedNumber';

/** Force the media query this component reads on first render. */
function setReducedMotion(reduce) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

afterEach(() => {
  setReducedMotion(false);
});

/**
 * The digits actually on screen.
 *
 * While rolling the component renders two spans — the visible frame and a
 * screen-reader-only copy of the true figure — so container.textContent
 * holds both and is twice the width of what anybody sees.
 */
const visible = (container) => container.firstChild?.firstChild?.textContent ?? '';
const isRolling = (container) => container.querySelector('.tallying') !== null;

describe('AnimatedNumber', () => {
  it('shows a placeholder until the value exists', () => {
    render(<AnimatedNumber value={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('lands on the real value', async () => {
    setReducedMotion(false);
    render(<AnimatedNumber value={56} duration={60} />);
    await waitFor(() => expect(screen.getByText('56')).toBeInTheDocument(), { timeout: 2000 });
  });

  // The roll is decoration; the figure is information. With motion off the
  // value has to be correct from the first paint, not merely arrive sooner.
  it('skips the roll entirely under reduced motion', () => {
    setReducedMotion(true);
    render(<AnimatedNumber value={120} duration={5000} />);
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(document.querySelector('.tallying')).toBeNull();
  });

  // A figure that grew a digit mid-roll would shove everything beside it.
  it('holds the final digit count while scrambling', async () => {
    setReducedMotion(false);
    const { container } = render(<AnimatedNumber value={56} duration={400} />);

    const widths = new Set();
    for (let i = 0; i < 8; i += 1) {
      const text = visible(container).replace(/\s/g, '');
      if (text && text !== '—') widths.add(text.length);
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(widths.size).toBeGreaterThan(0);
    // Every frame is two characters wide, like the answer.
    expect([...widths].every((w) => w === 2)).toBe(true);
  });

  it('applies the format function to the settled value', async () => {
    setReducedMotion(true);
    render(<AnimatedNumber value={950000} format={(n) => n.toLocaleString('vi-VN') + ' ₫'} />);
    expect(screen.getByText('950.000 ₫')).toBeInTheDocument();
  });

  // Statistics sit beside filters and tabs that re-render constantly. A
  // figure that re-rolled on every parent render would never sit still.
  it('does not re-roll when re-rendered with the same value', async () => {
    setReducedMotion(false);
    // Two digits, not one: a single-digit roll scrambles through 0–9 and
    // will hit the answer mid-flight, so "shows 7" cannot distinguish a
    // settled figure from a lucky frame.
    const { container, rerender } = render(<AnimatedNumber value={56} duration={60} />);

    // Both conditions at once. The rolling class is absent before the roll
    // starts as well as after it ends, so on its own it passes instantly
    // against the placeholder.
    await waitFor(
      () => {
        expect(isRolling(container)).toBe(false);
        expect(visible(container)).toBe('56');
      },
      { timeout: 2000 }
    );

    rerender(<AnimatedNumber value={56} duration={60} />);
    expect(isRolling(container)).toBe(false);
    expect(visible(container)).toBe('56');
  });

  // A screen reader must not read out the random frames.
  it('announces only the true figure while rolling', async () => {
    setReducedMotion(false);
    const { container } = render(<AnimatedNumber value={42} duration={4000} />);

    // The first animation frame is what swaps the placeholder for a
    // rolling figure, so wait for it rather than asserting on the paint
    // before it.
    await waitFor(() => expect(isRolling(container)).toBe(true), { timeout: 2000 });

    expect(container.querySelector('.sr-only')).toHaveTextContent('42');
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });
});
