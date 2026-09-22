import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Marketplace from './Marketplace';
import CartDrawer from './CartDrawer';
import { api, ApiError } from '../lib/api';
import { renderScreen, aProduct, signIn } from '../test/helpers';

const basket = aProduct({
  id: 'p1',
  title: 'Gùi carrying basket',
  priceVnd: 950000,
  stock: 6,
  provider: { id: 'pr1', displayName: 'Y Blă Êban', buon: 'Buôn Đôn' },
});

const cloth = aProduct({
  id: 'p2',
  title: 'Shoulder cloth',
  priceVnd: 1200000,
  stock: 3,
  provider: { id: 'pr2', displayName: "Amí H'Bia", buon: 'Buôn Akô Dhông' },
});

/** Both screens together, the way App renders them. */
function renderShop(products) {
  vi.spyOn(api, 'communityStats').mockResolvedValue({ verifiedArtisans: 5, buonOnboarded: 4 });
  vi.spyOn(api, 'products').mockResolvedValue(products);
  return renderScreen(
    <>
      <Marketplace />
      <CartDrawer />
    </>
  );
}

// The button reads "Added" for ~640ms after a press, so a second add has
// to wait for it to settle back rather than racing the confirmation.
const addButtons = () => screen.getAllByRole('button', { name: /Add to basket|Add another/i });
const addAgain = async (user, index = 0) => {
  const button = await waitFor(() => addButtons()[index]);
  await user.click(button);
};
const drawer = () => screen.getByRole('dialog', { name: /basket/i });

beforeEach(() => {
  localStorage.clear();
});

describe('cart', () => {
  it('adds a piece and counts it on the basket button', async () => {
    const user = userEvent.setup();
    renderShop([basket]);
    await screen.findByRole('heading', { name: /Gùi carrying basket/ });

    await user.click(addButtons()[0]);

    expect(await screen.findByRole('button', { name: /Basket, 1 items/i })).toBeInTheDocument();
  });

  it('opens the drawer showing the line, its price and its maker', async () => {
    const user = userEvent.setup();
    renderShop([basket]);
    await screen.findByRole('heading', { name: /Gùi carrying basket/ });

    await user.click(addButtons()[0]);
    await user.click(screen.getByRole('button', { name: /Basket, 1 items/i }));

    const panel = within(drawer());
    expect(panel.getByRole('heading', { name: /Gùi carrying basket/ })).toBeInTheDocument();
    expect(panel.getByText(/Y Blă Êban/)).toBeInTheDocument();
    // Twice: the unit price on the line and the line total at one unit.
    expect(panel.getAllByText('950.000 ₫')).toHaveLength(2);
  });

  it('changes quantity from the drawer and retotals', async () => {
    const user = userEvent.setup();
    renderShop([basket]);
    await screen.findByRole('heading', { name: /Gùi carrying basket/ });
    await user.click(addButtons()[0]);
    await user.click(screen.getByRole('button', { name: /Basket, 1 items/i }));

    const panel = within(drawer());
    await user.click(panel.getByRole('button', { name: /Add one/i }));

    // The line total and the cart total both move to two units.
    await waitFor(() => {
      expect(panel.getAllByText('1.900.000 ₫')).toHaveLength(2);
    });
  });

  // The API refuses an order spanning two providers, so a mixed basket has
  // to become two orders. Telling the buyer before they pay is the point.
  it('warns that a two-maker basket becomes two orders', async () => {
    const user = userEvent.setup();
    renderShop([basket, cloth]);
    await screen.findByRole('heading', { name: /Gùi carrying basket/ });

    const buttons = addButtons();
    await user.click(buttons[0]);
    await user.click(buttons[1]);
    await user.click(screen.getByRole('button', { name: /Basket, 2 items/i }));

    const panel = within(drawer());
    expect(panel.getByText(/come from 2 makers/i)).toBeInTheDocument();
    expect(panel.getByRole('button', { name: /Place order · 2 orders/i })).toBeInTheDocument();
  });

  it('places one order per maker', async () => {
    const user = userEvent.setup();
    signIn();
    const createOrder = vi.spyOn(api, 'createOrder').mockResolvedValue({ id: 'o1' });
    renderShop([basket, cloth]);
    await screen.findByRole('heading', { name: /Gùi carrying basket/ });

    const buttons = addButtons();
    await user.click(buttons[0]);
    await user.click(buttons[1]);
    await user.click(screen.getByRole('button', { name: /Basket, 2 items/i }));
    await user.click(within(drawer()).getByRole('button', { name: /Place order/i }));

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(2));
    // Each call carries exactly one maker's lines.
    for (const call of createOrder.mock.calls) {
      expect(call[0].items).toHaveLength(1);
    }
    expect(await screen.findByText(/Order placed/i)).toBeInTheDocument();
  });

  // The case worth getting right: one maker paid, one not. Reporting the
  // whole thing as done would hide a sale that never happened.
  it('keeps the failed maker in the basket and says so', async () => {
    const user = userEvent.setup();
    signIn();
    vi.spyOn(api, 'createOrder')
      .mockResolvedValueOnce({ id: 'o1' })
      .mockRejectedValueOnce(new ApiError('Only 1 left of "Shoulder cloth".', 409));

    renderShop([basket, cloth]);
    await screen.findByRole('heading', { name: /Gùi carrying basket/ });
    const buttons = addButtons();
    await user.click(buttons[0]);
    await user.click(buttons[1]);
    await user.click(screen.getByRole('button', { name: /Basket, 2 items/i }));
    await user.click(within(drawer()).getByRole('button', { name: /Place order/i }));

    expect(await screen.findByText(/Partly placed/i)).toBeInTheDocument();
    expect(screen.getByText(/Only 1 left/)).toBeInTheDocument();
    // The failed maker's line survives; the placed one does not.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Basket, 1 items/i })).toBeInTheDocument();
    });
  });

  it('asks for sign-in at checkout, not at add', async () => {
    const user = userEvent.setup();
    const createOrder = vi.spyOn(api, 'createOrder');
    renderShop([basket]);
    await screen.findByRole('heading', { name: /Gùi carrying basket/ });

    // Adding while signed out must work — that is the whole reason the
    // basket is client-side.
    await user.click(addButtons()[0]);
    expect(await screen.findByRole('button', { name: /Basket, 1 items/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Basket, 1 items/i }));
    await user.click(within(drawer()).getByRole('button', { name: /Place order/i }));

    expect(createOrder).not.toHaveBeenCalled();
  });

  it('never lets a line exceed stock', async () => {
    const user = userEvent.setup();
    renderShop([aProduct({ id: 'p3', title: 'Last piece', stock: 1 })]);
    await screen.findByRole('heading', { name: /Last piece/ });

    await user.click(addButtons()[0]);
    await addAgain(user);
    await user.click(screen.getByRole('button', { name: /Basket, 1 items/i }));

    const panel = within(drawer());
    expect(panel.getByRole('button', { name: /Add one/i })).toBeDisabled();
    expect(panel.getByText(/All 1 available are in your basket/i)).toBeInTheDocument();
  });

  it('survives a reload', async () => {
    const user = userEvent.setup();
    const { unmount } = renderShop([basket]);
    await screen.findByRole('heading', { name: /Gùi carrying basket/ });
    await user.click(addButtons()[0]);
    await screen.findByRole('button', { name: /Basket, 1 items/i });

    unmount();
    renderShop([basket]);

    expect(await screen.findByRole('button', { name: /Basket, 1 items/i })).toBeInTheDocument();
  });

  it('empties to a stated empty state rather than a blank panel', async () => {
    const user = userEvent.setup();
    renderShop([basket]);
    await screen.findByRole('heading', { name: /Gùi carrying basket/ });
    await user.click(addButtons()[0]);
    await user.click(screen.getByRole('button', { name: /Basket, 1 items/i }));

    await user.click(within(drawer()).getByRole('button', { name: /Remove .* from basket/i }));

    expect(await within(drawer()).findByText(/Nothing gathered yet/i)).toBeInTheDocument();
  });
});
