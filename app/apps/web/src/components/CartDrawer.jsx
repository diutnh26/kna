import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Minus, Plus, Trash2, ShoppingBag, CheckCircle2, MapPin, Loader2 } from 'lucide-react';
import ImageSlot from './ImageSlot';
import { api, ApiError } from '../lib/api';
import { useCart } from '../context/useCart';
import { useAuth } from '../context/useAuth';

const vnd = (n) => n.toLocaleString('vi-VN') + ' ₫';

// What the maker keeps. The 5% platform fee is applied by the API; this is
// the same arithmetic shown on the product cards, repeated here so the
// figure a person agrees to is the figure they were quoted.
const MAKER_SHARE = 0.95;

/**
 * The cart.
 *
 * Grouped by maker, because that is the shape the order actually takes:
 * the API refuses a cart spanning two providers, so checkout below places
 * one order per group. The grouping is stated in the UI rather than hidden,
 * since "three orders" is what will appear in the buyer's account and on
 * the public ledger.
 *
 * Rendered from App so it is reachable from any screen — someone who adds
 * a piece and then goes to read the archive still has their basket.
 */
export default function CartDrawer() {
  const { t } = useTranslation();
  const { groups, items, count, totalVnd, isOpen, close, setQuantity, remove, clear } = useCart();
  const { isAuthenticated, token, openAuthModal } = useAuth();

  const [phase, setPhase] = useState('idle'); // 'idle' | 'placing' | 'done' | 'error'
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState(null);
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  // Focus moves into the drawer on open so the keyboard goes with it, and
  // a screen reader is told where it now is.
  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
  }, [isOpen]);

  /**
   * Close, then forget the receipt.
   *
   * Cleared on the way out rather than on the way back in, so the panel
   * does not flash from receipt to empty cart while it is still sliding
   * off screen. The delay matches .drawer-panel's transition.
   */
  function dismiss() {
    close();
    setTimeout(() => {
      setPhase('idle');
      setResults([]);
      setError(null);
    }, 360);
  }

  /** Play the row's collapse before dropping it, so the list settles. */
  function removeLine(productId) {
    setRemoving(productId);
    setTimeout(() => {
      remove(productId);
      setRemoving(null);
    }, 260);
  }

  async function checkout() {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    setPhase('placing');
    setError(null);

    // One order per maker, in sequence. Sequential rather than parallel
    // because each order decrements stock inside a transaction, and firing
    // them together turns a clear "only two left" into a race whose loser
    // gets an error nobody can reproduce.
    const placed = [];
    for (const group of groups) {
      try {
        const order = await api.createOrder(
          {
            items: group.lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
            })),
          },
          token
        );
        placed.push({ group, order, ok: true });
      } catch (err) {
        placed.push({
          group,
          ok: false,
          message: err instanceof ApiError ? err.message : t('cart.orderError'),
        });
      }
    }

    setResults(placed);

    // A partial failure is the interesting case: some makers have been
    // paid and some have not. Keep exactly the failed lines in the cart so
    // the person can retry those without re-adding everything, and never
    // report the whole thing as done.
    const failed = placed.filter((entry) => !entry.ok);
    if (failed.length === 0) {
      clear();
      setPhase('done');
    } else {
      const keep = new Set(failed.flatMap((entry) => entry.group.lines.map((l) => l.productId)));
      for (const line of items) {
        if (!keep.has(line.productId)) remove(line.productId);
      }
      setPhase(placed.some((entry) => entry.ok) ? 'done' : 'error');
      setError(failed[0].message);
    }
  }

  return (
    <>
      {/* Backdrop. data-closed drives both the fade and, through
          allow-discrete, the delayed display:none — so the drawer animates
          out instead of vanishing. */}
      <div
        className="overlay-fade fixed inset-0 z-[60] bg-ink/70 backdrop-blur-sm"
        data-closed={isOpen ? undefined : ''}
        style={{ display: isOpen ? 'block' : 'none' }}
        onClick={dismiss}
        aria-hidden="true"
      />

      <aside
        ref={panelRef}
        className="drawer-panel glass fixed right-0 top-0 z-[61] h-dvh w-full max-w-md text-bone border-l flex flex-col shadow-2xl"
        data-closed={isOpen ? undefined : ''}
        style={{ display: isOpen ? 'flex' : 'none' }}
        role="dialog"
        aria-modal="true"
        aria-label={t('cart.title')}
      >
        <header className="flex items-center justify-between gap-4 px-6 py-5 border-b border-bone/15 shrink-0">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-4 h-4 text-copper" />
            <h2 className="font-display text-xl font-medium">{t('cart.title')}</h2>
            {count > 0 && <span className="text-xs text-bone/50">{t('cart.count', { count })}</span>}
          </div>
          <button
            ref={closeRef}
            onClick={dismiss}
            aria-label={t('cart.close')}
            className="p-2 -mr-2 text-bone/60 hover:text-bone transition"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {phase === 'done' ? (
            <Receipt results={results} t={t} onDone={dismiss} />
          ) : items.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <ShoppingBag className="w-8 h-8 text-bone/20 mx-auto mb-5" />
              <p className="font-display text-xl mb-2">{t('cart.emptyTitle')}</p>
              <p className="text-sm text-bone/50 leading-relaxed">{t('cart.emptyBody')}</p>
            </div>
          ) : (
            <div className="px-6 py-6 space-y-8">
              {/* Said once, up front, when it actually applies. A person
                  who discovers at the payment screen that one basket became
                  three orders has been surprised by their own purchase. */}
              {groups.length > 1 && (
                <p className="text-xs text-amber border border-amber/30 bg-amber/5 px-4 py-3 leading-relaxed">
                  {t('cart.splitNotice', { count: groups.length })}
                </p>
              )}

              {groups.map((group) => (
                <section key={group.providerId}>
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-copper mb-4">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span>{group.providerName}</span>
                    {group.providerBuon && (
                      <span className="text-bone/35 normal-case tracking-normal">
                        · {group.providerBuon}
                      </span>
                    )}
                  </div>

                  <ul className="space-y-4">
                    {group.lines.map((line) => (
                      <li
                        key={line.productId}
                        className={`flex gap-4 ${removing === line.productId ? 'row-remove' : ''}`}
                      >
                        <div className="w-20 shrink-0">
                          <ImageSlot src={line.imageUrl} ratio="aspect-square" label={line.title} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-display text-base leading-tight mb-1 truncate">
                            {line.title}
                          </h3>
                          <p className="text-[11px] text-bone/40 mb-3">
                            {vnd(line.priceVnd)} · {t('cart.each')}
                          </p>

                          <div className="flex items-center justify-between gap-3">
                            <div className="inline-flex items-center border border-bone/20">
                              <button
                                onClick={() => setQuantity(line.productId, line.quantity - 1)}
                                disabled={line.quantity <= 1}
                                aria-label={t('cart.decrease')}
                                className="px-2 py-1.5 text-bone/60 hover:text-bone disabled:opacity-30 transition"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span
                                className="px-3 text-sm tabular-nums"
                                aria-live="polite"
                                aria-label={t('cart.quantityLabel', { title: line.title })}
                              >
                                {line.quantity}
                              </span>
                              <button
                                onClick={() => setQuantity(line.productId, line.quantity + 1)}
                                disabled={line.quantity >= line.stock}
                                aria-label={t('cart.increase')}
                                className="px-2 py-1.5 text-bone/60 hover:text-bone disabled:opacity-30 transition"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="font-display text-amber text-sm tabular-nums">
                                {vnd(line.priceVnd * line.quantity)}
                              </span>
                              <button
                                onClick={() => removeLine(line.productId)}
                                aria-label={t('cart.remove', { title: line.title })}
                                className="text-bone/35 hover:text-kteh transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {line.quantity >= line.stock && (
                            <p className="text-[10px] text-bone/40 mt-2">
                              {t('cart.maxStock', { count: line.stock })}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>

                  {groups.length > 1 && (
                    <div className="flex justify-between text-xs text-bone/45 border-t border-bone/10 mt-4 pt-3">
                      <span>{t('cart.subtotalFor', { maker: group.providerName })}</span>
                      <span className="tabular-nums">{vnd(group.subtotalVnd)}</span>
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>

        {phase !== 'done' && items.length > 0 && (
          <footer className="border-t border-bone/15 px-6 py-5 shrink-0 space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-bone/60">{t('cart.total')}</span>
                <span className="font-display price-sm text-amber tabular-nums">
                  {vnd(totalVnd)}
                </span>
              </div>
              {/* The point of the platform, stated at the moment of payment
                  rather than only in the marketing copy above. */}
              <div className="flex justify-between text-[11px] text-bone/45">
                <span>{t('cart.toMakers')}</span>
                <span className="tabular-nums">{vnd(Math.round(totalVnd * MAKER_SHARE))}</span>
              </div>
            </div>

            {error && phase === 'error' && <p className="text-xs text-kteh">{error}</p>}

            <button
              onClick={checkout}
              disabled={phase === 'placing'}
              className="press glow-hover w-full inline-flex items-center justify-center gap-2 bg-kteh hover:bg-kteh-hover disabled:opacity-60 px-6 py-4 text-sm transition"
            >
              {phase === 'placing' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('cart.placing')}
                </>
              ) : (
                <>
                  {t('cart.checkout')}
                  {groups.length > 1 && ` · ${t('cart.ordersCount', { count: groups.length })}`}
                </>
              )}
            </button>

            <p className="text-[10px] text-bone/35 text-center leading-relaxed">
              {t('cart.paymentNote')}
            </p>
          </footer>
        )}
      </aside>
    </>
  );
}

/** What happened, per maker. Shown in place of the list after checkout. */
function Receipt({ results, t, onDone }) {
  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  return (
    <div className="px-6 py-10">
      <div className="text-center mb-8">
        <CheckCircle2 className="w-8 h-8 text-amber mx-auto mb-4" />
        <p className="font-display text-2xl mb-2">
          {failed.length === 0 ? t('cart.doneTitle') : t('cart.partialTitle')}
        </p>
        <p className="text-sm text-bone/55 leading-relaxed">
          {failed.length === 0
            ? t('cart.doneBody', { count: ok.length })
            : t('cart.partialBody', { placed: ok.length, failed: failed.length })}
        </p>
      </div>

      <ul className="space-y-3 mb-8">
        {results.map((entry, i) => (
          <li
            key={entry.group.providerId}
            className="stagger-item border border-bone/10 px-4 py-3"
            style={{ '--i': i }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">{entry.group.providerName}</span>
              <span
                className={`text-[10px] uppercase tracking-wider ${
                  entry.ok ? 'text-amber' : 'text-kteh'
                }`}
              >
                {entry.ok ? t('cart.orderPlaced') : t('cart.orderFailed')}
              </span>
            </div>
            {!entry.ok && <p className="text-xs text-bone/50 mt-1.5">{entry.message}</p>}
          </li>
        ))}
      </ul>

      <div className="space-y-3">
        <a
          href="#account"
          onClick={onDone}
          className="block text-center border border-bone/25 hover:border-bone/60 px-6 py-3 text-sm transition"
        >
          {t('cart.viewOrders')}
        </a>
        <button
          onClick={onDone}
          className="w-full text-center text-xs text-bone/45 hover:text-bone/80 transition py-2"
        >
          {t('cart.keepBrowsing')}
        </button>
      </div>
    </div>
  );
}
