import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AttestationPanel from './AttestationPanel';
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
