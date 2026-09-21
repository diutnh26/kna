import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LedgerProofBadge } from '../wallet/AttestationPanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => {
      if (key === 'wallet.proofState') return `Proof ${opts.state}`;
      if (key === 'wallet.viewExplorer') return 'View on Explorer';
      return key;
    },
  }),
}));

describe('LedgerProofBadge', () => {
  it('shows proof state and Explorer link', () => {
    render(
      <LedgerProofBadge
        attestation={{
          state: 'FINALIZED',
          payloadHash: 'abcdef0123456789deadbeef',
          explorer: {
            finalize: 'https://explorer.solana.com/tx/abc?cluster=devnet',
          },
        }}
      />
    );

    expect(screen.getByText(/Proof FINALIZED/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /View on Explorer/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('explorer.solana.com'));
  });
});
