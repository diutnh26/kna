import { useCallback, useEffect, useMemo, useState } from 'react';
import { CartContext } from './cartContext';

const STORAGE_KEY = 'kna.cart';

/**
 * What a cart line keeps about its product.
 *
 * A snapshot rather than an id, because the cart has to render before any
 * request resolves — a basket that is empty for 400ms on every page load
 * reads as a lost basket. Price and stock are re-checked by the API at
 * checkout, so a stale snapshot cannot become a wrong charge; the worst
 * case is a line that fails validation and says so.
 */
function snapshot(product, quantity) {
  return {
    productId: product.id,
    quantity,
    title: product.title,
    priceVnd: product.priceVnd,
    imageUrl: product.imageUrl ?? null,
    stock: product.stock,
    category: product.category,
    providerId: product.provider?.id ?? product.providerId ?? 'unknown',
    providerName: product.provider?.displayName ?? '—',
    providerBuon: product.provider?.buon ?? '',
  };
}

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Anything could be in localStorage — an older shape, a half-written
    // value, something a person pasted in. Keep only what is usable.
    return Array.isArray(parsed)
      ? parsed.filter((line) => line?.productId && Number.isFinite(line.quantity) && line.quantity > 0)
      : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(readStored);
  const [isOpen, setIsOpen] = useState(false);

  // Bumped whenever something is added. The navbar badge animates off this
  // rather than off the count, so adding a second unit of the same piece
  // still registers as an event.
  const [addedAt, setAddedAt] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Private browsing or blocked site data. The cart still works for
      // this visit; it just will not survive a reload.
    }
  }, [items]);

  // A drawer that leaves the page scrollable scrolls the page behind it on
  // a phone, which loses the reader's place entirely.
  useEffect(() => {
    if (!isOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const add = useCallback((product, quantity = 1) => {
    setItems((current) => {
      const existing = current.find((line) => line.productId === product.id);
      // Never past what is on the shelf. The API enforces this too; doing
      // it here means the person is told before they reach checkout.
      const capped = Math.min(
        (existing?.quantity ?? 0) + quantity,
        product.stock
      );
      if (capped <= 0) return current;

      return existing
        ? current.map((line) =>
            line.productId === product.id ? { ...line, quantity: capped, stock: product.stock } : line
          )
        : [...current, snapshot(product, Math.min(quantity, product.stock))];
    });
    setAddedAt(Date.now());
  }, []);

  const setQuantity = useCallback((productId, quantity) => {
    setItems((current) =>
      current.flatMap((line) => {
        if (line.productId !== productId) return [line];
        const next = Math.min(Math.max(1, quantity), line.stock);
        return [{ ...line, quantity: next }];
      })
    );
  }, []);

  const remove = useCallback((productId) => {
    setItems((current) => current.filter((line) => line.productId !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  /**
   * Cart lines grouped by maker.
   *
   * Not presentation. The API rejects an order spanning more than one
   * provider, because the ledger writes a single row per order attributed
   * to one maker and a mixed cart would publicly credit the whole sale to
   * whichever product came first. So a cart holding three makers is three
   * orders, and the drawer has to show that before anyone pays rather
   * than after.
   */
  const groups = useMemo(() => {
    const byProvider = new Map();
    for (const line of items) {
      const group = byProvider.get(line.providerId) ?? {
        providerId: line.providerId,
        providerName: line.providerName,
        providerBuon: line.providerBuon,
        lines: [],
        subtotalVnd: 0,
      };
      group.lines.push(line);
      group.subtotalVnd += line.priceVnd * line.quantity;
      byProvider.set(line.providerId, group);
    }
    return [...byProvider.values()];
  }, [items]);

  const count = useMemo(() => items.reduce((sum, line) => sum + line.quantity, 0), [items]);
  const totalVnd = useMemo(
    () => items.reduce((sum, line) => sum + line.priceVnd * line.quantity, 0),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      groups,
      count,
      totalVnd,
      addedAt,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      add,
      setQuantity,
      remove,
      clear,
      has: (productId) => items.some((line) => line.productId === productId),
    }),
    [items, groups, count, totalVnd, addedAt, isOpen, add, setQuantity, remove, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
