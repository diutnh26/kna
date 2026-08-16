import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ImageSlot from './ImageSlot';

/**
 * Photographs arrive a few at a time — a household sends one, the
 * Committee clears it — so every screen renders a mix of "photographed"
 * and "not yet" for a long while. This component is the whole of that
 * mechanism, and it now sits on six screens.
 */
describe('ImageSlot', () => {
  it('renders the photograph when there is one', () => {
    render(<ImageSlot src="/images/pillars/ching-kram.jpg" label="should show gongs" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/images/pillars/ching-kram.jpg');
    // Not eager: these sit well below the fold on long editorial pages.
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('prefers alt over the placeholder caption when describing a real photograph', () => {
    render(
      <ImageSlot
        src="/images/pillars/ching-kram.jpg"
        label="Cồng Chiêng — documentary photograph, vertical crop"
        alt="Two gong players silhouetted against a dust-lit sunset."
      />
    );
    // The caption answers "what is missing"; alt answers "what is here".
    // A screen-reader user given the caption learns only the crop.
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Two gong players silhouetted against a dust-lit sunset.'
    );
  });

  it('falls back to the label when no alt is given', () => {
    render(<ImageSlot src="/x.jpg" label="A gong set at dusk" />);
    expect(screen.getByRole('img')).toHaveAccessibleName('A gong set at dusk');
  });

  it('draws the labelled placeholder when there is no photograph', () => {
    render(<ImageSlot label="Cồng Chiêng — documentary photograph" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(/Cồng Chiêng — documentary photograph/)).toBeInTheDocument();
  });

  it('falls back to the placeholder if the photograph fails to load', () => {
    render(<ImageSlot src="/images/gone.jpg" label="A gong set at dusk" />);
    fireEvent.error(screen.getByRole('img'));

    // A broken-image glyph reads as a bug; the placeholder reads as a gap.
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('A gong set at dusk')).toBeInTheDocument();
  });

  it('hides the caption on thumbnails without losing the alt text', () => {
    const { rerender } = render(<ImageSlot label="Gùi carrying basket" showCaption={false} />);
    // No photograph yet: icon only, no caption repeating the heading beside it.
    expect(screen.queryByText('Gùi carrying basket')).not.toBeInTheDocument();

    rerender(<ImageSlot src="/x.jpg" label="Gùi carrying basket" showCaption={false} />);
    expect(screen.getByRole('img')).toHaveAccessibleName('Gùi carrying basket');
  });

  it('lets a caller choose what survives the crop', () => {
    // A landscape photograph in a portrait frame loses half its width.
    // Which half is an editorial decision, not a default.
    render(<ImageSlot src="/x.jpg" label="longhouse" position="34% 50%" />);
    expect(screen.getByRole('img')).toHaveStyle({ objectPosition: '34% 50%' });
  });

  it('centres the crop when no position is given', () => {
    render(<ImageSlot src="/x.jpg" label="gongs" />);
    expect(screen.getByRole('img')).toHaveStyle({ objectPosition: 'center' });
  });

});
