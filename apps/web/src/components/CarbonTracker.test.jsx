import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CarbonTracker from './CarbonTracker';
import { api } from '../lib/api';
import { renderScreen, signIn } from '../test/helpers';

/**
 * The offset now attaches to a booking rather than to nothing.
 *
 * The rule the picker exists to express: an offset is paid with a stay, so
 * there has to be a stay. One booking needs no choosing; two or more do.
 */

/**
 * Eligibility is decided by the server and read by the screen, so the
 * fixture supplies it exactly as GET /offsets/bookings does.
 */
const anActivity = (eligible, date = '2026-09-02') => ({
  yokdon: { nextActivityDate: date, eligible },
  lak: { nextActivityDate: date, eligible },
  corridor: { nextActivityDate: null, eligible: false },
});

const aBooking = (over = {}) => ({
  id: 'bk1',
  status: 'PENDING',
  checkIn: '2026-09-01T00:00:00.000Z',
  nights: 2,
  guests: 2,
  listingTitle: "Two nights in Amí H'Bia's longhouse",
  provider: "Amí H'Bia",
  buon: 'Buôn Akô Dhông',
  offset: null,
  activity: anActivity(false),
  ...over,
});

describe('CarbonTracker offsets', () => {
  beforeEach(() => {
    vi.spyOn(api, 'attachOffset').mockResolvedValue({ id: 'o1' });
  });

  it('asks a signed-out visitor to sign in, and fetches no bookings', async () => {
    const load = vi.spyOn(api, 'offsetBookings');
    renderScreen(<CarbonTracker />);

    expect(await screen.findByText(/Sign in to add an offset/)).toBeInTheDocument();
    expect(load).not.toHaveBeenCalled();
  });

  it('sends a guest with no bookings to the experiences first', async () => {
    signIn();
    vi.spyOn(api, 'offsetBookings').mockResolvedValue([]);
    renderScreen(<CarbonTracker />);

    expect(await screen.findByText(/You have no bookings yet/)).toBeInTheDocument();
    // An offset with nothing to attach to would be a donation, which is a
    // different product; the screen says so rather than inventing one.
    expect(screen.queryByRole('button', { name: /Add to my booking/i })).not.toBeInTheDocument();
  });

  it('does not make a guest choose when there is only one booking', async () => {
    signIn();
    vi.spyOn(api, 'offsetBookings').mockResolvedValue([aBooking()]);
    renderScreen(<CarbonTracker />);

    expect(await screen.findByText(/Adding to your stay at/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Which booking/i)).not.toBeInTheDocument();
  });

  it('offers a dropdown once there are two bookings', async () => {
    signIn();
    vi.spyOn(api, 'offsetBookings').mockResolvedValue([
      aBooking(),
      aBooking({ id: 'bk2', listingTitle: 'Lakeside longhouse, Buôn Trấp' }),
    ]);
    renderScreen(<CarbonTracker />);

    const picker = await screen.findByLabelText(/Which booking/i);
    expect(picker).toBeInTheDocument();
    expect(picker.querySelectorAll('option')).toHaveLength(2);
  });

  it('attaches the offset to the booking the guest picked', async () => {
    signIn();
    vi.spyOn(api, 'offsetBookings').mockResolvedValue([
      aBooking(),
      aBooking({ id: 'bk2', listingTitle: 'Lakeside longhouse, Buôn Trấp' }),
    ]);
    renderScreen(<CarbonTracker />);

    const picker = await screen.findByLabelText(/Which booking/i);
    fireEvent.change(picker, { target: { value: 'bk2' } });
    await userEvent.click(screen.getByRole('button', { name: /Add to my booking/i }));

    await waitFor(() => expect(api.attachOffset).toHaveBeenCalled());
    const [payload] = api.attachOffset.mock.calls[0];
    expect(payload.bookingId).toBe('bk2');
    expect(payload.projectId).toBe('yokdon');
    // The footprint is computed on the screen and priced on the server.
    expect(payload.kgCo2e).toBeGreaterThan(0);
    // The origin travels; the classification does not. The server decides
    // whether this is a long-haul journey, from the id alone.
    expect(payload.origin).toBe('hcmc');
    expect(payload).not.toHaveProperty('amountVnd');
    expect(payload).not.toHaveProperty('international');
  });

  it('says a booking already carries an offset rather than charging twice', async () => {
    signIn();
    vi.spyOn(api, 'offsetBookings').mockResolvedValue([
      aBooking({ offset: { projectId: 'lak', kgCo2e: 400, amountVnd: 380000, mode: 'DONATE' } }),
    ]);
    renderScreen(<CarbonTracker />);

    expect(await screen.findByText(/already carries an offset/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Remove$/i })).toBeInTheDocument();
  });

  it('tells the guest it is not on the ledger until the booking is confirmed', async () => {
    signIn();
    vi.spyOn(api, 'offsetBookings').mockResolvedValue([aBooking()]);
    renderScreen(<CarbonTracker />);

    await screen.findByText(/Adding to your stay at/);
    await userEvent.click(screen.getByRole('button', { name: /Add to my booking/i }));

    expect(await screen.findByText(/Added to your booking/)).toBeInTheDocument();
    expect(screen.getByText(/reaches the public ledger when a coordinator confirms/)).toBeInTheDocument();
  });

  // ── Two ways to take part ──────────────────────────────────────────

  describe('choosing how to take part', () => {
    it('offers joining the planting when a session falls in the stay', async () => {
      signIn();
      vi.spyOn(api, 'offsetBookings').mockResolvedValue([
        aBooking({ activity: anActivity(true) }),
      ]);
      renderScreen(<CarbonTracker />);

      expect(await screen.findByLabelText(/Join the planting/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/Leave your place/i)).not.toBeInTheDocument();
    });

    it('offers leaving the place forward when no session falls in the stay', async () => {
      signIn();
      vi.spyOn(api, 'offsetBookings').mockResolvedValue([
        aBooking({ activity: anActivity(false) }),
      ]);
      renderScreen(<CarbonTracker />);

      expect(await screen.findByLabelText(/Leave your place/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/Join the planting/i)).not.toBeInTheDocument();
    });

    it('sends IN_PERSON when the guest chooses to work the session', async () => {
      signIn();
      vi.spyOn(api, 'offsetBookings').mockResolvedValue([
        aBooking({ activity: anActivity(true) }),
      ]);
      renderScreen(<CarbonTracker />);

      await userEvent.click(await screen.findByLabelText(/Join the planting/i));
      await userEvent.click(screen.getByRole('button', { name: /Add to my booking/i }));

      await waitFor(() => expect(api.attachOffset).toHaveBeenCalled());
      expect(api.attachOffset.mock.calls[0][0].mode).toBe('IN_PERSON');
    });

    it('sends LEAVE_FORWARD when the dates do not meet a session', async () => {
      signIn();
      vi.spyOn(api, 'offsetBookings').mockResolvedValue([
        aBooking({ activity: anActivity(false) }),
      ]);
      renderScreen(<CarbonTracker />);

      await userEvent.click(await screen.findByLabelText(/Leave your place/i));
      await userEvent.click(screen.getByRole('button', { name: /Add to my booking/i }));

      await waitFor(() => expect(api.attachOffset).toHaveBeenCalled());
      expect(api.attachOffset.mock.calls[0][0].mode).toBe('LEAVE_FORWARD');
    });

    it('gives the corridor no choice at all, since it runs no sessions', async () => {
      signIn();
      vi.spyOn(api, 'offsetBookings').mockResolvedValue([aBooking()]);
      renderScreen(<CarbonTracker />);
      await screen.findByText(/Adding to your stay at/);

      await userEvent.click(screen.getByText(/Elephant corridor upkeep/));

      expect(screen.getByText(/no session to attend/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/Join the planting/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Leave your place/i)).not.toBeInTheDocument();
    });
  });

  // ── What the preview says it costs ─────────────────────────────────

  describe('donation preview', () => {
    const setOrigin = async (value) =>
      fireEvent.change(screen.getByLabelText(/Travelling from/i), { target: { value } });

    beforeEach(() => {
      signIn();
      vi.spyOn(api, 'offsetBookings').mockResolvedValue([aBooking()]);
    });

    it('shows the full rate for a domestic guest', async () => {
      renderScreen(<CarbonTracker />);
      await screen.findByText(/Adding to your stay at/);

      // Ho Chi Minh City by air, three nights: 150 + 12 + 9 = 171kg.
      // Yok Đôn at 1,100₫/kg, unadjusted.
      expect(screen.getAllByText(/188\.100 ₫/).length).toBeGreaterThan(0);
    });

    it('shows the adjusted share for a long-haul guest', async () => {
      renderScreen(<CarbonTracker />);
      await screen.findByText(/Adding to your stay at/);
      await setOrigin('europe');

      // 2400 + 12 + 9 = 2421kg at 1,100₫ × 0.35 = 932,085₫.
      expect(screen.getAllByText(/932\.085 ₫/).length).toBeGreaterThan(0);
      expect(screen.getByText(/Adjusted for a long journey/i)).toBeInTheDocument();
    });

    it('does not adjust the corridor, which has no sessions', async () => {
      renderScreen(<CarbonTracker />);
      await screen.findByText(/Adding to your stay at/);
      await setOrigin('europe');
      await userEvent.click(screen.getByText(/Elephant corridor upkeep/));

      // 2421kg at the full 1,350₫ — no share, no note.
      expect(screen.getAllByText(/3\.268\.350 ₫/).length).toBeGreaterThan(0);
      expect(screen.queryByText(/Adjusted for a long journey/i)).not.toBeInTheDocument();
    });

    it('says the Community Fund has already paid for the saplings', async () => {
      renderScreen(<CarbonTracker />);
      expect(
        await screen.findByText(/already sends 3% to the Community Fund/i)
      ).toBeInTheDocument();
    });
  });

});
