import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderScreen } from '../test/helpers';
import InteractiveMap from './InteractiveMap';

/**
 * The map is lazy-loaded from Explore, so for a while nothing mounted it and
 * the one browser API it needs — ResizeObserver, absent from jsdom — went
 * unnoticed. CI then failed on some pushes and passed on others depending on
 * whether the chunk resolved before the test that pulled it in had finished,
 * which is a bad way to learn about a missing global.
 *
 * Mounting it directly makes the next such gap a red test rather than a coin
 * flip. Leaflet is asserted through the class it puts on its own container,
 * because everything else it renders is tiles that never arrive here.
 */
describe('InteractiveMap', () => {
  it('initialises Leaflet rather than falling back', async () => {
    const { container } = renderScreen(<InteractiveMap />);

    await waitFor(() => expect(container.querySelector('.leaflet-container')).toBeTruthy());

    // The fallback is for tiles that never load. Leaflet starting up is a
    // different thing, and must not trip it.
    expect(screen.queryByText(/could not be loaded/i)).not.toBeInTheDocument();
  });

  it('draws the province and the city on top of the tiles', async () => {
    const { container } = renderScreen(<InteractiveMap />);

    // Both are vector overlays, so they land in Leaflet's SVG pane rather
    // than in the tile layer: a path for Đắk Lắk, a circle for Buôn Ma Thuột.
    await waitFor(() => expect(container.querySelector('.leaflet-overlay-pane path')).toBeTruthy());
    expect(container.querySelectorAll('.leaflet-overlay-pane path').length).toBeGreaterThan(1);
  });
});
