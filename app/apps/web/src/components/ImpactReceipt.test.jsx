import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18n from '../i18n';
import ImpactReceipt from './ImpactReceipt';

const split = {
  totalVnd: 500_000,
  providerVnd: 450_000,
  communityFundVnd: 15_000,
  platformFeeVnd: 35_000,
  provider: "H'Bia Homestay",
};

describe('ImpactReceipt', () => {
  it('shows where each part of the money goes, with its share', async () => {
    await i18n.changeLanguage('en');
    render(<ImpactReceipt {...split} status="awaiting" />);

    expect(screen.getByRole('region', { name: 'Impact receipt' })).toBeInTheDocument();
    expect(screen.getByText(/To H'Bia Homestay/)).toHaveTextContent('90%');
    expect(screen.getByText(/Community Fund/)).toHaveTextContent('3%');
    expect(screen.getByText(/KNĂ platform/)).toHaveTextContent('7%');
    expect(screen.getByText(/Nothing has moved yet/)).toBeInTheDocument();
    expect(screen.getByText(/recorded on Solana after confirmation/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('links the finalized proof on Explorer', async () => {
    await i18n.changeLanguage('en');
    render(
      <ImpactReceipt
        {...split}
        status="confirmed"
        proof={{ state: 'FINALIZED', explorerUrl: 'https://explorer.solana.com/tx/abc?cluster=devnet' }}
      />
    );
    expect(screen.getByText(/finalized on Solana/)).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', expect.stringContaining('explorer.solana.com'));
  });

  it('says when the program has paid the split out', async () => {
    await i18n.changeLanguage('en');
    render(
      <ImpactReceipt
        {...split}
        status="confirmed"
        proof={{ state: 'FINALIZED', settled: true, explorerUrl: 'https://explorer.solana.com/tx/s?cluster=devnet' }}
      />
    );
    expect(screen.getByText(/Paid out on Solana by the KNĂ program/)).toBeInTheDocument();
  });

  it('says plainly that a cancelled booking moved no money, and claims no proof', async () => {
    await i18n.changeLanguage('en');
    render(<ImpactReceipt {...split} status="cancelled" />);
    expect(screen.getByText(/No money moved/)).toBeInTheDocument();
    expect(screen.queryByText(/Solana/)).not.toBeInTheDocument();
  });

  it('reads in Vietnamese', async () => {
    await i18n.changeLanguage('vi');
    render(<ImpactReceipt {...split} status="confirmed" />);
    expect(screen.getByRole('region', { name: 'Biên nhận tác động' })).toBeInTheDocument();
    expect(screen.getByText(/Quỹ cộng đồng/)).toBeInTheDocument();
    await i18n.changeLanguage('en');
  });
});
