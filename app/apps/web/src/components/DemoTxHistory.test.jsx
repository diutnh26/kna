import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import DemoTxHistory from './DemoTxHistory';
import { api } from '../lib/api';
import { renderScreen } from '../test/helpers';

const item = {
  id: 'b1',
  at: '2026-09-21T04:30:57.000Z',
  title: "Two nights in Amí H'Bia's longhouse",
  guestName: 'Demo Traveler',
  providerName: "Amí H'Bia",
  buon: 'Buôn Akô Dhông',
  totalVnd: 500_000,
  providerPayoutVnd: 450_000,
  communityFundVnd: 15_000,
  paymentRef: 'TWRTCKHISTORY01',
  paymentStatus: 'PAID',
  demoTxSigs: ['sigexplorer1'],
  explorer: ['https://explorer.solana.com/tx/sigexplorer1?cluster=devnet'],
};

describe('DemoTxHistory', () => {
  beforeEach(() => {
    vi.spyOn(api, 'demoHistory').mockResolvedValue({ items: [item] });
  });

  it('shows a paid booking with the guest and the amount', async () => {
    renderScreen(<DemoTxHistory />);
    expect(await screen.findByText(/Two nights in Amí H'Bia/)).toBeInTheDocument();
    expect(screen.getByText(/Demo Traveler/)).toBeInTheDocument();
    expect(screen.getByText('500.000 ₫')).toBeInTheDocument();
  });

  it('links the mint to Solana Explorer', async () => {
    renderScreen(<DemoTxHistory />);
    const link = await screen.findByRole('link', { name: /View demo tx on Explorer/i });
    expect(link).toHaveAttribute(
      'href',
      'https://explorer.solana.com/tx/sigexplorer1?cluster=devnet'
    );
  });

  it('shows an empty state when nothing has been minted', async () => {
    api.demoHistory.mockResolvedValue({ items: [] });
    renderScreen(<DemoTxHistory />);
    expect(await screen.findByText(/No paid demo mints yet/i)).toBeInTheDocument();
  });

  it('shows a loading state until the history arrives', async () => {
    let resolve;
    api.demoHistory.mockImplementation(
      () =>
        new Promise((res) => {
          resolve = res;
        })
    );
    renderScreen(<DemoTxHistory />);
    expect(screen.getByText(/Loading demo transactions/i)).toBeInTheDocument();
    resolve({ items: [] });
    expect(await screen.findByText(/No paid demo mints yet/i)).toBeInTheDocument();
  });

  it('shows an error when the history request fails', async () => {
    api.demoHistory.mockRejectedValue(new Error('offline'));
    renderScreen(<DemoTxHistory />);
    expect(await screen.findByText(/Could not load demo history/i)).toBeInTheDocument();
  });
});
