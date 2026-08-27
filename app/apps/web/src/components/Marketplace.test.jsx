import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import Marketplace from './Marketplace';
import { api } from '../lib/api';
import { renderScreen, aProduct } from '../test/helpers';

/**
 * The marketplace, and the sold-out state in particular.
 *
 * That state was written into this card from the start and had never once
 * rendered: the API filtered `stock > 0`, so `soldOut` could not become
 * true. The bug it caused was visible only from an account page — a buyer
 * could see the piece they had bought while the marketplace showed no
 * trace of it. The hardcoded English "Sold out" that survived the whole
 * i18n pass is the other tell: nobody could see the branch it lived in.
 */
describe('Marketplace', () => {
  beforeEach(() => {
    vi.spyOn(api, 'communityStats').mockResolvedValue({ verifiedArtisans: 5, buonOnboarded: 4 });
  });

  it('shows a piece that is still available, with a way to buy it', async () => {
    vi.spyOn(api, 'products').mockResolvedValue([aProduct({ stock: 6 })]);
    renderScreen(<Marketplace />);

    expect(await screen.findByRole('heading', { name: /Gùi carrying basket/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Buy$/i })).toBeInTheDocument();
    expect(screen.getByText(/6 available/)).toBeInTheDocument();
  });

  it('keeps a sold-out piece on the page, marked and unbuyable', async () => {
    vi.spyOn(api, 'products').mockResolvedValue([aProduct({ stock: 0 })]);
    renderScreen(<Marketplace />);

    // Present — this is the whole point.
    expect(await screen.findByRole('heading', { name: /Gùi carrying basket/ })).toBeInTheDocument();
    // Marked, and not orderable.
    expect(screen.getAllByText(/Sold out/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^Buy$/i })).not.toBeInTheDocument();
  });

  it('does not call a sold-out piece "one of a kind"', async () => {
    // stock 1 earns that badge; stock 0 must not inherit it.
    vi.spyOn(api, 'products').mockResolvedValue([aProduct({ stock: 0 })]);
    renderScreen(<Marketplace />);

    await screen.findByRole('heading', { name: /Gùi carrying basket/ });
    expect(screen.queryByText(/One of a kind/i)).not.toBeInTheDocument();
  });

  it('marks the last remaining piece as one of a kind', async () => {
    vi.spyOn(api, 'products').mockResolvedValue([aProduct({ stock: 1 })]);
    renderScreen(<Marketplace />);

    expect(await screen.findByText(/One of a kind/i)).toBeInTheDocument();
    expect(screen.getByText(/Last one/i)).toBeInTheDocument();
  });

  it('still names the maker on a sold piece', async () => {
    // A sold piece keeps its story; only the purchase is gone.
    vi.spyOn(api, 'products').mockResolvedValue([aProduct({ stock: 0 })]);
    renderScreen(<Marketplace />);

    expect((await screen.findAllByText(/Y Blă Êban/)).length).toBeGreaterThan(0);
    expect(screen.getByText(/still made the everyday way/)).toBeInTheDocument();
  });
});
