import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import DemoWalletPanel from './DemoWalletPanel';
import { api } from '../lib/api';
import { renderScreen } from '../test/helpers';

const demoToken = (overrides = {}) => ({
  enabled: true,
  disclaimer: 'Demo token — not real payment. Devnet only.',
  mint: 'MintPubkey111',
  wallets: {
    guest: 'GuestPubkey111',
    provider: 'ProviderPubkey111',
    community: 'CommunityPubkey111',
  },
  explorer: {
    guest: 'https://explorer.solana.com/address/GuestPubkey111?cluster=devnet',
    provider: 'https://explorer.solana.com/address/ProviderPubkey111?cluster=devnet',
    community: 'https://explorer.solana.com/address/CommunityPubkey111?cluster=devnet',
    mint: 'https://explorer.solana.com/address/MintPubkey111?cluster=devnet',
  },
  balances: {
    symbol: 'dKNA',
    vndPerToken: 1000,
    guest: { uiAmount: 2, symbol: 'dKNA', approxVnd: 2000 },
    provider: { uiAmount: 450, symbol: 'dKNA', approxVnd: 450_000 },
    community: { uiAmount: 15, symbol: 'dKNA', approxVnd: 15_000 },
  },
  ...overrides,
});

describe('DemoWalletPanel', () => {
  beforeEach(() => {
    vi.spyOn(api, 'chainStatus').mockResolvedValue({ demoToken: demoToken() });
  });

  it('shows dKNA balances beside each wallet', async () => {
    renderScreen(<DemoWalletPanel />);
    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(screen.getByText('450')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getAllByText('dKNA').length).toBeGreaterThanOrEqual(3);
  });

  it('shows the VND equivalent next to a balance', async () => {
    renderScreen(<DemoWalletPanel />);
    expect(await screen.findByText('≈ 2.000 ₫')).toBeInTheDocument();
  });

  it('states the demo disclaimer and the token rate', async () => {
    renderScreen(<DemoWalletPanel />);
    expect(await screen.findByText(/Demo token — not real payment/)).toBeInTheDocument();
    expect(screen.getByText('1 dKNA ≈ 1000 VND (demo rate).')).toBeInTheDocument();
  });

  it('links each wallet to Solana Explorer', async () => {
    renderScreen(<DemoWalletPanel />);
    const links = await screen.findAllByRole('link', { name: /View on Explorer/i });
    expect(links.length).toBeGreaterThanOrEqual(3);
    expect(links[0]).toHaveAttribute('href', expect.stringContaining('explorer.solana.com'));
  });

  it('renders nothing when the demo mint is not configured', async () => {
    let settled = false;
    api.chainStatus.mockImplementation(async () => {
      settled = true;
      return { demoToken: { mint: null, wallets: {} } };
    });
    renderScreen(<DemoWalletPanel />);
    await waitFor(() => expect(settled).toBe(true));
    await waitFor(() => expect(screen.queryByText(/Demo wallets/i)).not.toBeInTheDocument());
  });
});
