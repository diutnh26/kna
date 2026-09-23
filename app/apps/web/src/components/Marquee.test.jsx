import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import Marquee from './Marquee';

const cards = (n) =>
  Array.from({ length: n }, (_, i) => <article key={i}>Tradition {i + 1}</article>);

describe('Marquee', () => {
  // The seamless loop depends entirely on the track holding the set exactly
  // twice, because the CSS translates it by exactly -50%. Any other count
  // and the row jumps at the wrap.
  it('renders the set twice so the loop has no seam', () => {
    const { container } = render(<Marquee label="Traditions">{cards(3)}</Marquee>);

    expect(container.querySelector('.marquee-track').children).toHaveLength(6);
    expect(screen.getAllByText('Tradition 1')).toHaveLength(2);
  });

  // Without this a screen reader reads every tradition twice, and the tab
  // order runs through a set of cards that are, to the reader, the same
  // cards again.
  it('hides the duplicate from assistive technology', () => {
    const { container } = render(<Marquee label="Traditions">{cards(3)}</Marquee>);
    const items = [...container.querySelector('.marquee-track').children];

    const hidden = items.filter((el) => el.getAttribute('aria-hidden') === 'true');
    expect(hidden).toHaveLength(3);
    // Exactly one readable copy of each card survives.
    const region = screen.getByRole('group', { name: 'Traditions' });
    expect(within(region).getAllByText('Tradition 2', { ignore: '[aria-hidden="true"] *' }));
  });

  // Duration is derived from distance so that a long row and a short one
  // drift at the same speed. Setting a duration directly would make a row
  // of ten sprint to keep the same cycle time.
  it('scales the cycle with the number of items, not the reverse', () => {
    const { container: few } = render(
      <Marquee label="A" speed={28} itemWidth={340} gap={32}>
        {cards(3)}
      </Marquee>
    );
    const { container: many } = render(
      <Marquee label="B" speed={28} itemWidth={340} gap={32}>
        {cards(9)}
      </Marquee>
    );

    const read = (c) =>
      parseFloat(c.querySelector('.marquee').style.getPropertyValue('--marquee-duration'));

    expect(read(many)).toBeGreaterThan(read(few));
  });

  it('renders nothing when there is nothing to show', () => {
    const { container } = render(<Marquee label="Empty">{[]}</Marquee>);
    expect(container.querySelector('.marquee')).toBeNull();
  });

  it('labels the row for assistive technology', () => {
    render(<Marquee label="Traditions">{cards(2)}</Marquee>);
    expect(screen.getByRole('group', { name: 'Traditions' })).toBeInTheDocument();
  });
});
