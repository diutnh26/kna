import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Explore from './Explore';
import { renderScreen } from '../test/helpers';
import { getEthnicity } from '../content/ethnicities';

function mockArchive() {
  vi.spyOn(api, 'archiveTypes').mockResolvedValue([{ type: 'Oral history', count: 2 }]);
  vi.spyOn(api, 'archiveStats').mockResolvedValue({
    publishedEntries: 7,
    contributingBuon: 3,
  });
  vi.spyOn(api, 'archive').mockResolvedValue([
    {
      id: 'a1',
      type: 'Oral history',
      title: 'The founding of the buôn',
      meta: 'Audio · 18 min',
      keeperBuon: 'Buôn Akô Dhông',
      imageUrl: null,
    },
  ]);
}

// Imported after the mock helper so the spies attach to the same module
// instance the component imports.
import { api } from '../lib/api';

beforeEach(() => {
  window.location.hash = '';
  document.documentElement.removeAttribute('data-ethnicity');
  document.documentElement.removeAttribute('style');
  mockArchive();
});

describe('Explore', () => {
  it('opens on Ê Đê with its traditions, places and phrasebook', async () => {
    renderScreen(<Explore />);

    const ede = getEthnicity('ede');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Ê Đê');

    for (const item of ede.identity) {
      expect(screen.getByRole('heading', { name: item.title.en })).toBeInTheDocument();
    }
    expect(screen.getByText('Buôn Akŏ Dhông')).toBeInTheDocument();
    expect(screen.getByText('Hê drei')).toBeInTheDocument();

    // The archive index is live for Ê Đê, so entries render rather than the
    // "not open here" notice.
    expect(await screen.findByText('The founding of the buôn')).toBeInTheDocument();
  });

  it('replaces the whole profile when another people is chosen', async () => {
    const user = userEvent.setup();
    renderScreen(<Explore />);
    await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByRole('tab', { name: 'Khmer' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Khmer');
    });
    expect(screen.getByText('Chumreap Suor')).toBeInTheDocument();
    // Ê Đê content must be gone, not merely scrolled past.
    expect(screen.queryByText('Hê drei')).not.toBeInTheDocument();
  });

  // The whole provenance argument rests on not passing research off as
  // community-reviewed record.
  it('says the archive is not open for a research-compiled profile', async () => {
    const user = userEvent.setup();
    renderScreen(<Explore />);
    await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByRole('tab', { name: 'Tày' }));

    await waitFor(() => {
      expect(screen.getByText(/archive is not open here yet/i)).toBeInTheDocument();
    });
    expect(screen.queryByText('The founding of the buôn')).not.toBeInTheDocument();
    expect(
      screen.getByText(/Compiled from published research, not yet reviewed/i)
    ).toBeInTheDocument();
  });

  it('shows the missing-phrases notice for Lô Lô instead of inventing any', async () => {
    const user = userEvent.setup();
    renderScreen(<Explore />);
    await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByRole('tab', { name: 'Lô Lô' }));

    await waitFor(() => {
      expect(screen.getByText(/No greetings recorded yet/i)).toBeInTheDocument();
    });
  });

  // A photograph of the right people in the wrong place has to say so on
  // the page, not only in the source file.
  it('prints the photograph credit and any provenance caveat', async () => {
    const user = userEvent.setup();
    renderScreen(<Explore />);
    await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByRole('tab', { name: "H'Mông" }));

    await waitFor(() => {
      expect(screen.getAllByText(/Bắc Hà market, Lào Cai/i).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/CC BY/).length).toBeGreaterThan(0);
  });

  it('surfaces the UN Tourism recognition on the profile that has one', async () => {
    const user = userEvent.setup();
    renderScreen(<Explore />);
    await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByRole('tab', { name: 'Lô Lô' }));

    // Named twice on purpose: once as the award on the place, once as what
    // UN Tourism did in the institutions list.
    await waitFor(() => {
      expect(screen.getAllByText(/Best Tourism Village/i).length).toBeGreaterThan(0);
    });
    expect(screen.getByText('Bản Lô Lô Chải')).toBeInTheDocument();
  });
});
