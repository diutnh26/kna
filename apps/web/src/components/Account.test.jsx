import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Account from './Account';
import { api } from '../lib/api';
import { renderScreen, signIn } from '../test/helpers';

/**
 * The account screen. What is asserted here is mostly the money: a person
 * is being told how much of what they paid reached a household, and that
 * figure has to come from the server rather than be recomputed in the UI —
 * the same rule the booking screen is held to.
 */

const anAccount = (overrides = {}) => ({
  user: {
    id: 'u1',
    email: 'guest@example.kna',
    fullName: 'Demo Traveler',
    role: 'GUEST',
    locale: 'en',
    memberSince: '2026-03-02T00:00:00.000Z',
    isCommitteeMember: false,
    committeeRole: null,
    provider: null,
  },
  totals: {
    bookings: 2,
    bookingsAwaiting: 1,
    orders: 1,
    ordersAwaiting: 0,
    contributions: 1,
    spentVnd: 1_400_000,
    toProvidersVnd: 1_280_000,
    toCommunityFundVnd: 30_000,
    offsets: 1,
    offsetsJoining: 1,
    offsetKgCo2e: 612,
    toOffsetProjectsVnd: 673_200,
  },
  ...overrides,
});

const activity = [
  {
    kind: 'booking',
    id: 'b1',
    at: '2026-08-10T00:00:00.000Z',
    status: 'CONFIRMED',
    title: "Two nights in Amí H'Bia's longhouse",
    imageUrl: null,
    from: "Amí H'Bia",
    buon: 'Buôn Akô Dhông',
    checkIn: '2026-09-01T00:00:00.000Z',
    nights: 2,
    guests: 2,
    totalVnd: 1_000_000,
    toProviderVnd: 900_000,
    toCommunityFundVnd: 30_000,
    offset: { projectId: 'yokdon', kgCo2e: 612, amountVnd: 673_200, joining: true },
  },
  {
    kind: 'order',
    id: 'o1',
    at: '2026-08-05T00:00:00.000Z',
    status: 'PAID',
    title: 'Gùi carrying basket',
    imageUrl: null,
    from: 'Y Blă Êban',
    buon: 'Buôn Đôn',
    itemCount: 1,
    totalVnd: 400_000,
    toProviderVnd: 380_000,
    toCommunityFundVnd: 0,
  },
  {
    kind: 'contribution',
    id: 'c1',
    at: '2026-07-20T00:00:00.000Z',
    status: 'REJECTED',
    title: 'Request to film a funeral ceremony',
    imageUrl: null,
    entryType: 'Recording',
    moderationNote: 'Funerals are not filmed.',
  },
];

describe('Account', () => {
  beforeEach(() => {
    vi.spyOn(api, 'account').mockResolvedValue(anAccount());
    vi.spyOn(api, 'accountActivity').mockResolvedValue(activity);
  });

  it('asks an anonymous visitor to sign in, and fetches nothing', async () => {
    renderScreen(<Account />);
    expect(await screen.findByText(/Sign in to see your account/)).toBeInTheDocument();
    expect(api.account).not.toHaveBeenCalled();
  });

  it('shows what reached the households, from the server', async () => {
    signIn();
    renderScreen(<Account />);

    expect(await screen.findByText('1.400.000 ₫')).toBeInTheDocument();
    expect(screen.getByText('1.280.000 ₫')).toBeInTheDocument();
    expect(screen.getByText('30.000 ₫')).toBeInTheDocument();
    expect(screen.getByText(/reached the households directly/)).toBeInTheDocument();
  });

  it('says plainly that pending money is not counted', async () => {
    signIn();
    renderScreen(<Account />);
    expect(
      await screen.findByText(/Confirmed bookings and settled orders only/)
    ).toBeInTheDocument();
  });

  it('renders all three kinds of activity in one list', async () => {
    signIn();
    renderScreen(<Account />);

    expect(await screen.findByText(/Two nights in Amí H'Bia/)).toBeInTheDocument();
    expect(screen.getByText(/Gùi carrying basket/)).toBeInTheDocument();
    expect(screen.getByText(/Request to film a funeral/)).toBeInTheDocument();
  });

  it('shows a refusal with the Committee reason attached', async () => {
    signIn();
    renderScreen(<Account />);
    expect(await screen.findByText(/Not published/)).toBeInTheDocument();
    expect(screen.getByText(/Funerals are not filmed/)).toBeInTheDocument();
  });

  it('filters the timeline without refetching', async () => {
    signIn();
    renderScreen(<Account />);
    await screen.findByText(/Two nights in Amí H'Bia/);

    await userEvent.click(screen.getByRole('button', { name: /^Purchases$/i }));

    expect(screen.getByText(/Gùi carrying basket/)).toBeInTheDocument();
    expect(screen.queryByText(/Two nights in Amí H'Bia/)).not.toBeInTheDocument();
    expect(api.accountActivity).toHaveBeenCalledTimes(1);
  });

  it('will not offer to edit the sign-in address', async () => {
    signIn();
    renderScreen(<Account />);
    const email = await screen.findByLabelText(/^Email$/i);
    expect(email).toBeDisabled();
    expect(screen.getByText(/needs a confirmation email/)).toBeInTheDocument();
  });

  it('saves a name change and refreshes the session', async () => {
    signIn();
    const updated = anAccount();
    updated.user.fullName = "H'Linh Êban";
    vi.spyOn(api, 'updateAccount').mockResolvedValue(updated);
    vi.spyOn(api, 'me').mockResolvedValue({ user: updated.user });

    renderScreen(<Account />);
    const name = await screen.findByLabelText(/^Name$/i);
    fireEvent.change(name, { target: { value: "H'Linh Êban" } });
    await userEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => expect(api.updateAccount).toHaveBeenCalled());
    expect(api.updateAccount.mock.calls[0][0]).toMatchObject({ fullName: "H'Linh Êban" });
    expect(await screen.findByText(/Saved\./)).toBeInTheDocument();
  });

  it('surfaces the server error rather than a generic one', async () => {
    signIn();
    const { ApiError } = await import('../lib/api');
    vi.spyOn(api, 'changePassword').mockRejectedValue(
      new ApiError('That is not your current password.', 403)
    );

    renderScreen(<Account />);
    fireEvent.change(await screen.findByLabelText(/Current password/i), {
      target: { value: 'wrong' },
    });
    fireEvent.change(screen.getByLabelText(/New password/i), { target: { value: 'longenough1' } });
    await userEvent.click(screen.getByRole('button', { name: /^Change password$/i }));

    expect(await screen.findByText(/That is not your current password/)).toBeInTheDocument();
  });

  // ── Carbon offsets ─────────────────────────────────────────────────

  it('shows an offset on the booking that paid for it', async () => {
    signIn();
    renderScreen(<Account />);

    await screen.findByText(/Two nights in Amí H'Bia/);
    expect(screen.getByText(/612 kg through/)).toBeInTheDocument();
    // Twice on purpose: once on the booking, once in the summary total.
    expect(screen.getAllByText(/673\.200 ₫/)).toHaveLength(2);
  });

  it('surfaces the planting day the guest committed to', async () => {
    // The part worth reminding someone of is not the payment, it is the
    // date they said they would turn up and work.
    signIn();
    renderScreen(<Account />);

    expect(await screen.findByText(/joining the planting on your last day/)).toBeInTheDocument();
    expect(screen.getByText(/1 planting day you have signed up for/)).toBeInTheDocument();
  });

  it('counts offset money apart from what reached households', async () => {
    // An offset takes no commission and no Fund share, so folding it into
    // toProviders would credit a household with money that went to a
    // planting site.
    signIn();
    renderScreen(<Account />);

    expect(await screen.findByText(/to carbon offset projects/)).toBeInTheDocument();
    expect(screen.getAllByText(/673\.200 ₫/).length).toBeGreaterThan(0);
    // Kept out of the households figure.
    expect(screen.getByText('1.280.000 ₫')).toBeInTheDocument();
  });

  it('filters the timeline down to bookings carrying an offset', async () => {
    signIn();
    renderScreen(<Account />);
    await screen.findByText(/Two nights in Amí H'Bia/);

    await userEvent.click(screen.getByRole('button', { name: /^Offsets$/i }));

    expect(screen.getByText(/Two nights in Amí H'Bia/)).toBeInTheDocument();
    // The purchase has no offset, so it drops out.
    expect(screen.queryByText(/Gùi carrying basket/)).not.toBeInTheDocument();
  });

  it('points at the tracker when there are no offsets to show', async () => {
    signIn();
    vi.spyOn(api, 'accountActivity').mockResolvedValue([
      { ...activity[1] }, // the order only
    ]);
    renderScreen(<Account />);
    await screen.findByText(/Gùi carrying basket/);

    await userEvent.click(screen.getByRole('button', { name: /^Offsets$/i }));

    expect(screen.getByText(/No offsets yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open the impact tracker/i })).toBeInTheDocument();
  });

});
