import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../lib/api';
import MyTrips from './MyTrips';
import ProviderCalendar from './ProviderCalendar';
import Trace from './Trace';
import '../i18n';

const { signAndSendTransaction } = vi.hoisted(() => ({ signAndSendTransaction: vi.fn() }));
vi.mock('../wallet/WalletProvider', () => ({
  useWallet: () => ({ connected: true, connect: vi.fn(), signAndSendTransaction }),
}));
vi.mock('./Navbar', () => ({ default: () => null }));

const vnToday = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
const stay = (overrides = {}) => ({
  id: 'bk1',
  status: 'CONFIRMED',
  checkIn: '2026-01-01T00:00:00.000Z',
  checkOut: `${vnToday()}T00:00:00.000Z`,
  rooms: 1,
  totalVnd: 500_000,
  listing: { title: 'Longhouse stay' },
  ...overrides,
});

afterEach(() => {
  vi.restoreAllMocks();
  signAndSendTransaction.mockReset();
});

describe('MyTrips', () => {
  it('keeps Pay closed before the check-out date', async () => {
    vi.spyOn(api, 'myBookings').mockResolvedValue([stay({ checkOut: '2099-01-02T00:00:00.000Z' })]);
    render(<MyTrips />);
    expect(await screen.findByRole('button', { name: /Pay now/i })).toBeDisabled();
    expect(screen.getByText(/Payment opens on your check-out date, 2099-01-02/)).toBeInTheDocument();
  });

  it('pays from Phantom when that is the paying wallet: sign, then confirm', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'myBookings')
      .mockResolvedValueOnce([stay()])
      .mockResolvedValueOnce([stay({ status: 'COMPLETED' })]);
    vi.spyOn(api, 'payBooking').mockResolvedValue({ needsSignature: true, transactionBase64: 'dHg=' });
    const confirm = vi.spyOn(api, 'confirmBookingPayment').mockResolvedValue({ status: 'COMPLETED' });
    signAndSendTransaction.mockResolvedValue('sig-pay');

    render(<MyTrips />);
    await user.click(await screen.findByRole('button', { name: /Pay now/i }));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith('bk1', 'sig-pay'));
    expect(signAndSendTransaction).toHaveBeenCalledWith('dHg=');
    expect(await screen.findByText('Paid')).toBeInTheDocument();
  });
});

describe('ProviderCalendar', () => {
  it('opens a range of days and shows the calendar again', async () => {
    const user = userEvent.setup();
    const load = vi.spyOn(api, 'listingAvailability').mockResolvedValue({ days: [] });
    const set = vi.spyOn(api, 'setAvailability').mockResolvedValue({ ok: true, days: 30 });
    render(<ProviderCalendar listings={[{ id: 'l1', title: 'Longhouse', unit: 'per night', inventory: 2 }]} />);
    expect(await screen.findByText('2 rooms')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Open these days/i }));
    await waitFor(() => expect(set).toHaveBeenCalledWith('l1', expect.objectContaining({ open: true })));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });
});

describe('Trace', () => {
  it('looks up a booking from the link and shows its split and transactions', async () => {
    window.location.hash = '#trace?q=bk1';
    vi.spyOn(api, 'traceBooking').mockResolvedValue({
      id: 'bk1',
      listing: 'Longhouse stay',
      host: "Amí H'Bia",
      checkIn: '2026-10-01',
      checkOut: '2026-10-02',
      status: 'COMPLETED',
      split: { totalVnd: 500_000, providerVnd: 450_000, communityFundVnd: 15_000, platformVnd: 35_000 },
      wallets: { guest: null, provider: null, communityFund: null, platform: null, paidBy: null },
      onchain: { status: 'PAID', matchesLedger: true, paidAt: null },
      transactions: {
        recorded: null,
        paid: { signature: '5'.repeat(88), explorer: 'https://explorer.solana.com/tx/555?cluster=devnet' },
        attested: null,
        finalized: null,
      },
    });
    render(<Trace />);
    expect(await screen.findByText('Longhouse stay')).toBeInTheDocument();
    expect(screen.getByText(/matches the public ledger/i)).toBeInTheDocument();
    expect(api.traceBooking).toHaveBeenCalledWith('bk1');
    window.location.hash = '';
  });
});
