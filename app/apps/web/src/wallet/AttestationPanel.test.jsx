import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AttestationPanel, { CommitteeFinalizePanel } from './AttestationPanel';
import { isSolanaAddress, isSolanaSignature } from './solanaFormat';
import { api } from '../lib/api';

const { signAndSendTransaction } = vi.hoisted(() => ({ signAndSendTransaction: vi.fn() }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => (key === 'wallet.withdrawnNote' ? `Withdrawn: ${opts.reason}` : key),
  }),
}));

vi.mock('../context/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true }) }));

vi.mock('./WalletProvider', () => ({
  useWallet: () => ({
    connected: true,
    pubkey: 'Coord1111111111111111111111111111111111111',
    connect: vi.fn(),
    signAndSendTransaction,
  }),
}));

function attestation(state, extra = {}) {
  return { state, payloadHash: 'abcdef0123456789', explorer: {}, ...extra };
}

describe('AttestationPanel', () => {
  beforeEach(() => {
    signAndSendTransaction.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('offers submit before anything is on-chain', async () => {
    vi.spyOn(api, 'chainLedger').mockResolvedValue(attestation('PENDING_SIGNATURE'));
    render(<AttestationPanel ledgerEntryId="ledger-1" />);
    expect(await screen.findByText('wallet.submitAttestation')).toBeInTheDocument();
    expect(screen.queryByText('wallet.withdrawAttestation')).not.toBeInTheDocument();
  });

  it('offers withdrawal, not a second submit, while it awaits the committee', async () => {
    vi.spyOn(api, 'chainLedger').mockResolvedValue(attestation('AWAITING_COMMITTEE'));
    render(<AttestationPanel ledgerEntryId="ledger-1" />);
    expect(await screen.findByText('wallet.withdrawAttestation')).toBeInTheDocument();
    expect(screen.queryByText('wallet.submitAttestation')).not.toBeInTheDocument();
  });

  it('withdraws with a recorded reason: prepare, sign in Phantom, then verify', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'chainLedger')
      .mockResolvedValueOnce(attestation('AWAITING_COMMITTEE'))
      .mockResolvedValueOnce(attestation('CANCELLED', { cancelReason: 'wrong household' }));
    const prepare = vi
      .spyOn(api, 'chainCancelPrepare')
      .mockResolvedValue({ transactionBase64: 'dHg=' });
    const cancel = vi.spyOn(api, 'chainCancel').mockResolvedValue({ state: 'CANCELLED' });
    signAndSendTransaction.mockResolvedValue('sig-cancel');

    render(<AttestationPanel ledgerEntryId="ledger-1" />);
    await user.click(await screen.findByText('wallet.withdrawAttestation'));

    const confirm = screen.getByRole('button', { name: 'wallet.withdrawConfirm' });
    await user.type(screen.getByRole('textbox'), 'no');
    expect(confirm).toBeDisabled(); // a reason is recorded, so it must say something

    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'wrong household');
    await user.click(confirm);

    await waitFor(() => expect(cancel).toHaveBeenCalled());
    expect(prepare).toHaveBeenCalledWith('ledger-1', {
      coordinatorPubkey: 'Coord1111111111111111111111111111111111111',
    });
    expect(signAndSendTransaction).toHaveBeenCalledWith('dHg=');
    expect(cancel).toHaveBeenCalledWith('ledger-1', {
      cancelTxSig: 'sig-cancel',
      reason: 'wrong household',
    });
    expect(await screen.findByText('Withdrawn: wrong household')).toBeInTheDocument();
    expect(screen.queryByText('wallet.submitAttestation')).not.toBeInTheDocument();
  });

  it('keeps the attestation and shows the error when verification fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'chainLedger').mockResolvedValue(attestation('AWAITING_COMMITTEE'));
    vi.spyOn(api, 'chainCancelPrepare').mockResolvedValue({ transactionBase64: 'dHg=' });
    vi.spyOn(api, 'chainCancel').mockRejectedValue(
      new Error('Pending attestation is not cancelled on-chain')
    );
    signAndSendTransaction.mockResolvedValue('sig-cancel');

    render(<AttestationPanel ledgerEntryId="ledger-1" />);
    await user.click(await screen.findByText('wallet.withdrawAttestation'));
    await user.type(screen.getByRole('textbox'), 'wrong household');
    await user.click(screen.getByRole('button', { name: 'wallet.withdrawConfirm' }));

    expect(
      await screen.findByText('Pending attestation is not cancelled on-chain')
    ).toBeInTheDocument();
    // The form stays open so the coordinator can try again.
    expect(screen.getByRole('textbox')).toHaveValue('wrong household');
  });
});

describe('Solana value checks', () => {
  it('accepts real-length base58 signatures and addresses only', () => {
    expect(isSolanaSignature('4'.repeat(88))).toBe(true);
    expect(isSolanaSignature('4'.repeat(40))).toBe(false);
    expect(isSolanaSignature(`mock_${'A'.repeat(83)}`)).toBe(false); // "_" is not base58
    expect(isSolanaSignature('0'.repeat(88))).toBe(false); // nor is "0"
    expect(isSolanaAddress('3yY8ey4qCgN6kRLdbobDKU78siQJqWgP8Hum1sUcia42')).toBe(true);
    expect(isSolanaAddress('3yY8ey4q')).toBe(false);
  });
});

describe('CommitteeFinalizePanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const row = { ledgerEntryId: 'ledger-committee-1', toLabel: "H'Bia Homestay", totalVnd: 500000 };

  it('records a finalize signature from an inline field, refusing a malformed one', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'chainAwaitingCommittee')
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([]);
    const finalize = vi.spyOn(api, 'chainFinalize').mockResolvedValue({ state: 'FINALIZED' });

    render(<CommitteeFinalizePanel />);
    await user.click(await screen.findByRole('button', { name: 'wallet.recordFinalize' }));

    const field = screen.getByRole('textbox');
    const submit = screen.getByRole('button', { name: 'wallet.recordFinalize' });
    await user.type(field, 'not-a-signature');
    expect(screen.getByText('wallet.invalidSignature')).toBeInTheDocument();
    expect(submit).toBeDisabled();

    await user.clear(field);
    await user.type(field, '4'.repeat(88));
    expect(screen.queryByText('wallet.invalidSignature')).not.toBeInTheDocument();
    await user.click(submit);

    await waitFor(() =>
      expect(finalize).toHaveBeenCalledWith('ledger-committee-1', { finalizeTxSig: '4'.repeat(88) })
    );
    expect(await screen.findByText('wallet.noAwaiting')).toBeInTheDocument();
  });

  it('exports the Squads proposal without a multisig PDA, refusing a malformed one', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'chainAwaitingCommittee').mockResolvedValue([row]);
    const proposal = vi.spyOn(api, 'chainSquadsProposal').mockResolvedValue({
      vault: 'vault',
      pendingPda: 'pending',
      finalPda: 'final',
      instruction: { dataBase64: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
    });

    render(<CommitteeFinalizePanel />);
    await user.click(await screen.findByRole('button', { name: 'wallet.exportSquadsProposal' }));
    await user.type(screen.getByRole('textbox'), 'short');
    expect(screen.getByText('wallet.invalidAddress')).toBeInTheDocument();
    await user.clear(screen.getByRole('textbox'));
    await user.click(screen.getByRole('button', { name: 'wallet.exportSquadsProposal' }));

    await waitFor(() =>
      expect(proposal).toHaveBeenCalledWith('ledger-committee-1', { multisigPda: undefined })
    );
  });
});
