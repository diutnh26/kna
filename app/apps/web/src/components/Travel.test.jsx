import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Travel from './Travel';
import { api, ApiError } from '../lib/api';
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
    vi.spyOn(api, 'chainStatus').mockResolvedValue({ demoToken: null });
    vi.spyOn(api, 'listingAvailability').mockRejectedValue(new Error('not mocked'));
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


  it('keeps the price on one line, in its own row', async () => {
    // The price used to share a flex row with the booking controls. That
    // was fine while those were a number box and a button; the date picker
    // pushed the row past the card width and the parent took the space out
    // of the price, wrapping "2.500.000 ₫" mid-figure.
    //
    // jsdom cannot measure layout, so this asserts the two things that
    // actually prevent it: the price does not wrap, and it is not a
    // sibling of the controls.
    renderScreen(<Travel />);
    const price = await screen.findByText('500.000 ₫');

    expect(price).toHaveClass('whitespace-nowrap');

    const date = screen.getByLabelText(/Arrival date/i);
    expect(price.parentElement.contains(date)).toBe(false);
  });





  it('sends a stay with the nights and guests the guest chose', async () => {
    signIn();
    vi.spyOn(api, 'createBooking').mockResolvedValue({ id: 'b1', status: 'CONFIRMED', checkOut: '2026-11-04' });

    renderScreen(<Travel />);
    await screen.findByRole('heading', { name: /Two nights/ });

    fireEvent.change(screen.getByLabelText(/Nights/i), { target: { value: '3' } });
    const checkIn = pickArrivalDate();
    await userEvent.click(screen.getByRole('button', { name: /^Book$/ }));

    await waitFor(() => expect(api.createBooking).toHaveBeenCalled());
    const [payload] = api.createBooking.mock.calls[0];
    // A stay: the number is nights, and the guests decide how many rooms.
    expect(payload).toMatchObject({ listingId: 'l1', nights: 3, guests: 2, checkIn });
  });

  it('confirms at once and says payment is taken on the check-out date', async () => {
    signIn();
    vi.spyOn(api, 'createBooking').mockResolvedValue({
      id: 'b1',
      status: 'CONFIRMED',
      checkOut: '2026-11-04T00:00:00.000Z',
      totalVnd: 500_000,
      providerPayoutVnd: 450_000,
      communityFundVnd: 15_000,
      platformFeeVnd: 35_000,
    });

    renderScreen(<Travel />);
    await screen.findByRole('heading', { name: /Two nights/ });
    pickArrivalDate();
    await userEvent.click(screen.getByRole('button', { name: /^Book$/ }));

    expect(await screen.findByText(/^Confirmed$/i)).toBeInTheDocument();
    expect(screen.getByText(/You pay from your wallet on your check-out date, 2026-11-04/)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /QR/i })).not.toBeInTheDocument();
  });

  it('points to a top-up when the wallet cannot cover the stay', async () => {
    signIn();
    vi.spyOn(api, 'createBooking').mockRejectedValue(
      new ApiError('Your wallet does not hold enough dKNA for this stay yet. Top up first.', 402)
    );

    renderScreen(<Travel />);
    await screen.findByRole('heading', { name: /Two nights/ });
    pickArrivalDate();
    await userEvent.click(screen.getByRole('button', { name: /^Book$/ }));

    expect(await screen.findByText(/does not hold enough dKNA/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Top up your wallet/i })).toHaveAttribute('href', '#account');
  });

  it('shows how many rooms are left for the chosen dates, or which night is full', async () => {
    signIn();
    const available = vi.spyOn(api, 'listingAvailability');
    renderScreen(<Travel />);
    await screen.findByRole('heading', { name: /Two nights/ });

    available.mockImplementation(async (_id, from) => ({
      days: [{ date: from, capacity: 2, booked: 1, available: 1 }],
    }));
    pickArrivalDate();
    expect(await screen.findByText(/1 room left for these dates/i)).toBeInTheDocument();

    available.mockImplementation(async (_id, from) => ({
      days: [{ date: from, capacity: 2, booked: 2, available: 0 }],
    }));
    fireEvent.change(screen.getByLabelText(/Arrival date/i), { target: { value: '2027-01-15' } });
    expect(await screen.findByText(/2027-01-15 is fully booked/i)).toBeInTheDocument();
  });

});
