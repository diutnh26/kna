import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import InitialAvatar from './InitialAvatar';

/**
 * The stand-in for a Committee portrait that does not exist yet.
 *
 * The property that matters most is the one it must never acquire: this
 * has to stay obviously not-a-person. The roster names six real-sounding
 * individuals with seats and buôn, and a synthetic face there would be
 * indistinguishable from documentation once screenshotted away from the
 * demonstration banner.
 */
describe('InitialAvatar', () => {
  it('shows first and last initials', () => {
    render(<InitialAvatar name="Amí H'Bia" />);
    expect(screen.getByText('AH')).toBeInTheDocument();
  });

  it('keeps Ê Đê diacritics rather than normalising them away', () => {
    render(<InitialAvatar name="Aduôn Sun" />);
    expect(screen.getByText('AS')).toBeInTheDocument();
  });

  it('handles a single-part name', () => {
    render(<InitialAvatar name="Hbia" />);
    expect(screen.getByText('Hb')).toBeInTheDocument();
  });

  it('does not fall over on an empty name', () => {
    render(<InitialAvatar name="" />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('gives the same person the same colour every time', () => {
    const { container: a } = render(<InitialAvatar name="Y Wik Niê" />);
    const { container: b } = render(<InitialAvatar name="Y Wik Niê" />);
    expect(a.firstChild.style.backgroundColor).toBe(b.firstChild.style.backgroundColor);
    expect(a.firstChild.style.backgroundColor).not.toBe('');
  });

  it('is hidden from screen readers, since the name is already beside it', () => {
    const { container } = render(<InitialAvatar name="Amí Lan" />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders no image, so it can never be mistaken for a photograph', () => {
    render(<InitialAvatar name="H'Ni Bya" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
