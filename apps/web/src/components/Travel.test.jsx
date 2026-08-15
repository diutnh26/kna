import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Travel from './Travel';
import { api } from '../lib/api';
import { renderScreen, signIn, aListing } from '../test/helpers';

/**
 * These are smoke tests: they check the screen renders real data, that the
 * booking path behaves, and — most importantly — that what a guest is shown
 * about money comes from the server rather than being invented in the UI.
 */
/**
 * Bookings now require an arrival date, because a household has to hold a
 * specific day. Every path that expects a request to go out has to pick one.
 */
function pickArrivalDate() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  const iso = d.toISOString().slice(0, 10);
  fireEvent.change(screen.getByLabelText(/Arrival date/i), { target: { value: iso } });
  return iso;
}

describe('Travel', () => {
  beforeEach(() => {
    vi.spyOn(api, 'listings').mockResolvedValue([aListing()]);
  });

  it('renders a listing from the API, not a hardcoded array', async () => {
    renderScreen(<Travel />);
    expect(
      await screen.findByRole('heading', { name: /Two nights in Amí H'Bia/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/Hosted by Amí H'Bia · Buôn Akô Dhông/)).toBeInTheDocument();
    expect(screen.getByText('500.000 ₫')).toBeInTheDocument();
  });

  it('shows the API error state when the backend is unreachable', async () => {
    api.listings.mockRejectedValue(new Error('boom'));
    renderScreen(<Travel />);
    expect(await screen.findByText(/reach the KNĂ API/)).toBeInTheDocument();
  });

  it('tells the guest when a filter combination has nothing, without inventing results', async () => {
    api.listings.mockResolvedValue([]);
    renderScreen(<Travel />);
    expect(await screen.findByText(/Nothing in that combination yet/)).toBeInTheDocument();
  });

  it('asks a signed-out visitor to sign in rather than failing the booking', async () => {
    const createBooking = vi.spyOn(api, 'createBooking');
    renderScreen(<Travel />);
    await screen.findByRole('heading', { name: /Two nights/ });

    await userEvent.click(screen.getByRole('button', { name: /^Book$/ }));

    expect(createBooking).not.toHaveBeenCalled();
    // The auth modal is mounted by App, so here we assert the useful half:
    // no request was sent and no error was shown to the guest.
    expect(screen.queryByText(/Could not send that booking/)).not.toBeInTheDocument();
  });

  it('sends a booking with the quantity the guest chose', async () => {
    signIn();
    vi.spyOn(api, 'createBooking').mockResolvedValue({
      id: 'b1',
      status: 'PENDING',
      payment: { provider: 'manual', status: 'AWAITING_PAYMENT', instructions: 'A KNĂ coordinator will confirm your dates.' },
    });

    renderScreen(<Travel />);
    await screen.findByRole('heading', { name: /Two nights/ });

    const qty = screen.getByLabelText(/Nights/i);
    fireEvent.change(qty, { target: { value: '3' } });
    const checkIn = pickArrivalDate();
    await userEvent.click(screen.getByRole('button', { name: /^Book$/ }));

    await waitFor(() => expect(api.createBooking).toHaveBeenCalled());
    const [payload] = api.createBooking.mock.calls[0];
    // "per night" listing: the number chosen is nights, and guests is 1.
    expect(payload).toMatchObject({ listingId: 'l1', nights: 3, guests: 1, checkIn });
  });

  it("shows the server's payment instruction verbatim, not UI-invented reassurance", async () => {
    signIn();
    const instructions =
      'A KNĂ coordinator will confirm your dates with the household and arrange payment directly with you. Nothing is charged through this site.';
    vi.spyOn(api, 'createBooking').mockResolvedValue({
      id: 'b1',
      status: 'PENDING',
      payment: { provider: 'manual', status: 'AWAITING_PAYMENT', instructions },
    });

    renderScreen(<Travel />);
    await screen.findByRole('heading', { name: /Two nights/ });
    pickArrivalDate();
    await userEvent.click(screen.getByRole('button', { name: /^Book$/ }));

    expect(await screen.findByText(instructions)).toBeInTheDocument();
  });

  it('surfaces the server error message rather than a generic one', async () => {
    signIn();
    const { ApiError } = await import('../lib/api');
    vi.spyOn(api, 'createBooking').mockRejectedValue(new ApiError('Those dates are taken.', 409));

    renderScreen(<Travel />);
    await screen.findByRole('heading', { name: /Two nights/ });
    pickArrivalDate();
    await userEvent.click(screen.getByRole('button', { name: /^Book$/ }));

    expect(await screen.findByText('Those dates are taken.')).toBeInTheDocument();
  });

  it('queries the server when the guest searches, instead of filtering locally', async () => {
    renderScreen(<Travel />);
    await screen.findByRole('heading', { name: /Two nights/ });

    await userEvent.type(screen.getByLabelText(/Search experiences/i), 'Wik');

    await waitFor(
      () => expect(api.listings).toHaveBeenCalledWith(expect.objectContaining({ q: 'Wik' })),
      { timeout: 2000 }
    );
  });

  it('states the revenue split the API actually implements', async () => {
    renderScreen(<Travel />);
    expect(await screen.findByText('90%')).toBeInTheDocument();
    expect(screen.getByText('3%')).toBeInTheDocument();
    expect(screen.getByText('7%')).toBeInTheDocument();
  });

  it('will not send a booking without an arrival date', async () => {
    signIn();
    const createBooking = vi.spyOn(api, 'createBooking');

    renderScreen(<Travel />);
    await screen.findByRole('heading', { name: /Two nights/ });
    await userEvent.click(screen.getByRole('button', { name: /^Book$/ }));

    // Caught in the form, not by a round trip that comes back 400.
    expect(createBooking).not.toHaveBeenCalled();
    expect(await screen.findByText(/Choose an arrival date first/i)).toBeInTheDocument();
  });

});
