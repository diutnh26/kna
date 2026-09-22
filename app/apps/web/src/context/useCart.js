import { useContext } from 'react';
import { CartContext } from './cartContext';

/**
 * The cart, and the ways to change it.
 *
 * Returns an inert cart outside a provider rather than throwing, so a
 * component test can render one screen without wrapping it. Every mutator
 * is a no-op there, which is the honest behaviour: there is no cart.
 */
const EMPTY = {
  items: [],
  groups: [],
  count: 0,
  totalVnd: 0,
  addedAt: 0,
  isOpen: false,
  open: () => {},
  close: () => {},
  add: () => {},
  setQuantity: () => {},
  remove: () => {},
  clear: () => {},
  has: () => false,
};

export function useCart() {
  return useContext(CartContext) ?? EMPTY;
}
