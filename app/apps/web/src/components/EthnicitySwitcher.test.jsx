import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EthnicitySwitcher from './EthnicitySwitcher';
import { renderScreen } from '../test/helpers';
import { ETHNICITIES, DEFAULT_SLUG, getEthnicity } from '../content/ethnicities';
import { slugFromHash } from '../lib/ethnicityHash';

beforeEach(() => {
  window.location.hash = '';
  document.documentElement.removeAttribute('data-ethnicity');
  document.documentElement.removeAttribute('style');
});

describe('EthnicitySwitcher', () => {
  it('offers every profile and starts on the default', () => {
    renderScreen(<EthnicitySwitcher />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(ETHNICITIES.length);
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent(
      getEthnicity(DEFAULT_SLUG).name.en
    );
  });

  it('switches profile on click and records it in the URL', async () => {
    const user = userEvent.setup();
    renderScreen(<EthnicitySwitcher />);

    await user.click(screen.getByRole('tab', { name: 'Tày' }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Tày' })).toHaveAttribute('aria-selected', 'true');
    });
    expect(slugFromHash(window.location.hash)).toBe('tay');
  });

  // The default profile stays out of the URL so the canonical link to the
  // page is still #explore rather than #explore?e=ede.
  it('leaves the default slug out of the hash', async () => {
    const user = userEvent.setup();
    window.location.hash = '#explore';
    renderScreen(<EthnicitySwitcher />);

    await user.click(screen.getByRole('tab', { name: 'Khmer' }));
    await waitFor(() => expect(window.location.hash).toContain('e=khmer'));

    await user.click(screen.getByRole('tab', { name: 'Ê Đê' }));
    await waitFor(() => expect(window.location.hash).toBe('#explore'));
  });

  it('paints the accent palette onto the document element', async () => {
    const user = userEvent.setup();
    renderScreen(<EthnicitySwitcher />);

    await waitFor(() => {
      expect(document.documentElement.dataset.ethnicity).toBe(DEFAULT_SLUG);
    });

    await user.click(screen.getByRole('tab', { name: 'Lô Lô' }));

    await waitFor(() => {
      expect(document.documentElement.dataset.ethnicity).toBe('lolo');
    });
    // The custom properties are what every themed utility reads; if these
    // stop being written the switch changes the text and nothing else.
    expect(document.documentElement.style.getPropertyValue('--c-kteh')).toBe(
      getEthnicity('lolo').theme.kteh
    );
  });

  it('moves between tabs with the arrow keys', async () => {
    const user = userEvent.setup();
    renderScreen(<EthnicitySwitcher />);

    await user.tab();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Ê Đê' })).toHaveFocus());

    await user.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Tày' })).toHaveAttribute('aria-selected', 'true');
    });

    // Wrapping backwards from the first tab lands on the last, per the
    // ARIA tablist pattern.
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    await waitFor(() => {
      expect(
        screen.getByRole('tab', { name: ETHNICITIES[ETHNICITIES.length - 1].name.en })
      ).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('keeps only the selected tab in the tab order', () => {
    renderScreen(<EthnicitySwitcher />);

    const reachable = screen.getAllByRole('tab').filter((tab) => tab.tabIndex === 0);
    expect(reachable).toHaveLength(1);
    expect(reachable[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('opens on the profile named in the URL rather than the default', async () => {
    window.location.hash = '#explore?e=hmong';
    renderScreen(<EthnicitySwitcher />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: "H'Mông" })).toHaveAttribute('aria-selected', 'true');
    });
  });

  // A link with a slug that no longer exists should open the page, not
  // break it.
  it('falls back to the default for an unknown slug', async () => {
    window.location.hash = '#explore?e=atlantis';
    renderScreen(<EthnicitySwitcher />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { selected: true })).toHaveTextContent(
        getEthnicity(DEFAULT_SLUG).name.en
      );
    });
  });

  it('prefetches the next profile photographs on hover', async () => {
    const user = userEvent.setup();
    const created = [];
    const RealImage = window.Image;
    vi.stubGlobal(
      'Image',
      class {
        constructor() {
          created.push(this);
        }
        set src(value) {
          this._src = value;
        }
        get src() {
          return this._src;
        }
      }
    );

    renderScreen(<EthnicitySwitcher />);
    await user.hover(screen.getByRole('tab', { name: 'Khmer' }));

    const khmer = getEthnicity('khmer');
    expect(created).toHaveLength(khmer.identity.length);
    expect(created.map((img) => img.src)).toEqual(khmer.identity.map((i) => i.image.src));

    vi.stubGlobal('Image', RealImage);
  });
});
