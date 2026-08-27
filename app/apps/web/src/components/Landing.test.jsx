import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Landing from './Landing';
import { api } from '../lib/api';
import { renderScreen, aLedgerEntry } from '../test/helpers';

const stats = (over = {}) => ({
  committeeMembers: 6,
  verifiedProviders: 10,
  verifiedArtisans: 5,
  buonOnboarded: 4,
  ledgerEntriesToday: 2,
  communityFundTotalVnd: 43500000,
  ...over,
});

describe('Landing', () => {
  beforeEach(() => {
    vi.spyOn(api, 'ledger').mockResolvedValue([aLedgerEntry()]);
    vi.spyOn(api, 'communityStats').mockResolvedValue(stats());
  });

  it('renders real ledger transactions, not invented ones', async () => {
    renderScreen(<Landing />);
    expect(await screen.findByText('Traveler #4821')).toBeInTheDocument();
    expect(screen.getByText('1.000.000 ₫')).toBeInTheDocument();
  });

  it('says so plainly when no transactions exist, instead of showing samples', async () => {
    api.ledger.mockResolvedValue([]);
    renderScreen(<Landing />);
    expect(await screen.findByText(/No transactions recorded yet/)).toBeInTheDocument();
  });

  it('hides the "+N more today" line when there is nothing more', async () => {
    // 1 entry shown, 1 today — nothing remains.
    api.communityStats.mockResolvedValue(stats({ ledgerEntriesToday: 1 }));
    renderScreen(<Landing />);
    await screen.findByText('Traveler #4821');
    expect(screen.queryByText(/more transactions today/)).not.toBeInTheDocument();
  });

  it('shows the real remaining count when there is more', async () => {
    api.communityStats.mockResolvedValue(stats({ ledgerEntriesToday: 9 }));
    renderScreen(<Landing />);
    expect(await screen.findByText(/8 more transactions today/)).toBeInTheDocument();
  });

  it('reports the counted partner figure from the API', async () => {
    renderScreen(<Landing />);
    expect(await screen.findByText('10')).toBeInTheDocument();
  });

  it('still renders when the API is unreachable — it is a marketing page', async () => {
    api.ledger.mockRejectedValue(new Error('offline'));
    api.communityStats.mockRejectedValue(new Error('offline'));
    renderScreen(<Landing />);
    expect(await screen.findByText(/Tracked, not promised/)).toBeInTheDocument();
  });

  it('points its calls to action at real destinations', async () => {
    renderScreen(<Landing />);
    const begin = await screen.findAllByRole('link', { name: /Begin the journey/ });
    expect(begin[0]).toHaveAttribute('href', '#travel');
    // Appears twice — hero CTA and footer — and both must go somewhere real.
    const howItWorks = screen.getAllByRole('link', { name: /How it works/ });
    expect(howItWorks.length).toBeGreaterThan(0);
    howItWorks.forEach((a) => expect(a).toHaveAttribute('href', '#community'));
  });

  it('has no dead "#" links left in the footer', async () => {
    renderScreen(<Landing />);
    await screen.findByText(/Tracked, not promised/);
    const dead = screen.getAllByRole('link').filter((a) => a.getAttribute('href') === '#');
    expect(dead).toHaveLength(0);
  });

  it('switches the whole page to Vietnamese when the language is toggled', async () => {
    renderScreen(<Landing />);
    await screen.findByText(/Tracked, not promised/);

    await userEvent.click(screen.getByRole('button', { name: /Switch language/i }));

    expect(await screen.findByText(/Được theo dõi, không chỉ hứa hẹn/)).toBeInTheDocument();
    expect(screen.queryByText(/Tracked, not promised/)).not.toBeInTheDocument();
  });
});
