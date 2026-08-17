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
    expect(payload).not.toHaveProperty('amountVnd');
  });

  it('carries the intention to join the planting', async () => {
    signIn();
    vi.spyOn(api, 'offsetBookings').mockResolvedValue([aBooking()]);
    renderScreen(<CarbonTracker />);

    await screen.findByText(/Adding to your stay at/);
    await userEvent.click(screen.getByLabelText(/join the planting/i));
    await userEvent.click(screen.getByRole('button', { name: /Add to my booking/i }));

    await waitFor(() => expect(api.attachOffset).toHaveBeenCalled());
    expect(api.attachOffset.mock.calls[0][0].joining).toBe(true);
  });

  it('says a booking already carries an offset rather than charging twice', async () => {
    signIn();
    vi.spyOn(api, 'offsetBookings').mockResolvedValue([
      aBooking({ offset: { projectId: 'lak', kgCo2e: 400, amountVnd: 380000, joining: false } }),
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
});
