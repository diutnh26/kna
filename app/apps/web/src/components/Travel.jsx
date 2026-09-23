import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  MapPin,
  Users,
  Clock,
  Leaf,
  BadgeCheck,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import Navbar from './Navbar';
import ImageSlot from './ImageSlot';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../context/useAuth';
import { useDebounced } from '../lib/useDebounced';
import ApiErrorNotice from './ApiErrorNotice';
import DemoWalletPanel from './DemoWalletPanel';
import ImpactReceipt from './ImpactReceipt';

const CATEGORIES = ['All', 'Stay', 'Guided walk', 'Craft session', 'Ceremony'];
const BUON = ['All buôn', 'Buôn Akô Dhông', 'Buôn Đôn', 'Buôn Trấp'];

// UI label <-> API enum. The Listing.category column is an enum
// (STAY / GUIDED_WALK / ...); everything the guest sees is the label.
const CATEGORY_TO_API = {
  Stay: 'STAY',
  'Guided walk': 'GUIDED_WALK',
  'Craft session': 'CRAFT_SESSION',
  Ceremony: 'CEREMONY',
};
// API enum -> the i18n key whose value the guest reads. The filter values
// themselves stay in English: they are state, and they are what gets sent
// to the API. Translating those would break the query.
const CATEGORY_KEYS = {
  STAY: 'travel.categoryStay',
  GUIDED_WALK: 'travel.categoryGuidedWalk',
  CRAFT_SESSION: 'travel.categoryCraftSession',
  CEREMONY: 'travel.categoryCeremony',
};
const FILTER_KEYS = {
  All: 'travel.filterAll',
  Stay: 'travel.categoryStay',
  'Guided walk': 'travel.categoryGuidedWalk',
  'Craft session': 'travel.categoryCraftSession',
  Ceremony: 'travel.categoryCeremony',
  'All buôn': 'travel.filterAllBuon',
};

const vnd = (n) => n.toLocaleString('vi-VN') + ' ₫';

export default function Travel() {
  const { t } = useTranslation();
  const split = t('travel.split', { returnObjects: true });
  const [category, setCategory] = useState('All');
  const [buon, setBuon] = useState('All buôn');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);
  const [listings, setListings] = useState([]);
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'error'

  // bookings[listingId] = { qty, checkIn, status: 'idle'|'submitting'|'done'|'error', error }
  const [bookings, setBookings] = useState({});
  const { isAuthenticated, openAuthModal } = useAuth();

  // Floor for the date picker. Local date, not toISOString() — that converts
  // to UTC first, so anywhere east of Greenwich (Vietnam is UTC+7) would
  // offer yesterday as a valid arrival for the first seven hours of the day.
  const today = useMemo(() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  // Deliberately doesn't flip back to 'loading' on every filter change —
  // the previous results stay on screen (stale-while-revalidate) until the
  // new ones are in, so picking a filter doesn't flash an empty state.
  useEffect(() => {
    let cancelled = false;
    api
      .listings({
        category: category === 'All' ? undefined : CATEGORY_TO_API[category],
        buon: buon === 'All buôn' ? undefined : buon,
        q: debouncedSearch || undefined,
      })
      .then((data) => {
        if (!cancelled) {
          setListings(data);
          setLoadState('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [category, buon, debouncedSearch]);

  // Poll payment + demo mint status after booking when we have a paymentRef.
  useEffect(() => {
    const pending = Object.entries(bookings).filter(
      ([, b]) =>
        b?.status === 'done' &&
        b.paymentRef &&
        b.paymentStatus !== 'PAID' &&
        !(b.demoTxSigs?.length)
    );
    if (pending.length === 0) return undefined;

    let cancelled = false;
    const tick = async () => {
      for (const [listingId, b] of pending) {
        try {
          const st = await api.paymentStatus(b.paymentRef);
          if (cancelled) return;
          if (st.paymentStatus === 'PAID' || (st.demoTxSigs && st.demoTxSigs.length)) {
            setBookings((prev) => ({
              ...prev,
              [listingId]: {
                ...prev[listingId],
                paymentStatus: st.paymentStatus,
                demoTxSigs: st.demoTxSigs ?? [],
              },
            }));
          }
        } catch {
          /* ignore transient poll errors */
        }
      }
    };

    tick();
    const id = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // Re-subscribe when the set of refs awaiting payment changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    Object.entries(bookings)
      .filter(([, b]) => b?.status === 'done' && b.paymentRef && b.paymentStatus !== 'PAID')
      .map(([, b]) => b.paymentRef)
      .join(','),
  ]);

  function qtyFor(listing) {
    return bookings[listing.id]?.qty ?? 1;
  }

  function setQty(listing, qty) {
    setBookings((b) => ({ ...b, [listing.id]: { ...b[listing.id], qty: Math.max(1, qty) } }));
  }

  function checkInFor(listing) {
    return bookings[listing.id]?.checkIn ?? '';
  }

  function setCheckIn(listing, checkIn) {
    setBookings((b) => ({ ...b, [listing.id]: { ...b[listing.id], checkIn } }));
  }

  async function handleBook(listing) {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    const qty = qtyFor(listing);
    const checkIn = checkInFor(listing);
    const perNight = listing.unit === 'per night';

    // The household has to hold a specific day. Asking here beats a
    // coordinator chasing the guest by phone afterwards.
    if (!checkIn) {
      setBookings((b) => ({
        ...b,
        [listing.id]: { ...b[listing.id], qty, status: 'error', error: t('travel.needDate') },
      }));
      return;
    }

    setBookings((b) => ({ ...b, [listing.id]: { ...b[listing.id], qty, status: 'submitting', error: null } }));
    try {
      const created = await api.createBooking({
        listingId: listing.id,
        guests: perNight ? 1 : qty,
        nights: perNight ? qty : 1,
        checkIn,
      });
      setBookings((b) => ({
        ...b,
        [listing.id]: {
          ...b[listing.id],
          qty,
          status: 'done',
          error: null,
          bookingId: created.id,
          // The split as the server computed it, for the impact receipt.
          totalVnd: created.totalVnd,
          providerPayoutVnd: created.providerPayoutVnd,
          communityFundVnd: created.communityFundVnd,
          platformFeeVnd: created.platformFeeVnd,
          paymentRef: created.paymentRef ?? created.payment?.paymentRef,
          payment: created.payment,
          demoTxSigs: (() => {
            if (!created.demoTxSigs) return [];
            if (Array.isArray(created.demoTxSigs)) return created.demoTxSigs;
            try {
              return JSON.parse(created.demoTxSigs);
            } catch {
              return [];
            }
          })(),
        },
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('travel.bookingError');
      setBookings((b) => ({ ...b, [listing.id]: { ...b[listing.id], qty, status: 'error', error: message } }));
    }
  }

  const shown = listings;

  return (
    <div className="min-h-screen bg-ink text-bone font-body antialiased">
      <Navbar active="travel" theme="dark" />

      {/* ── OPENING ───────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-20 md:py-24 grid md:grid-cols-12 gap-12 items-end">
        <div className="md:col-span-7">
          <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-copper mb-8">
            <span className="h-px w-12 bg-copper" />
            <span>{t('travel.eyebrow')}</span>
          </div>
          <h1 className="font-display page-title-sm font-medium leading-[1.05] tracking-tight mb-8">
            {t('travel.title')}
          </h1>
          <p className="text-lg text-bone/70 max-w-2xl leading-relaxed">
            {t('travel.intro')}
          </p>
        </div>

        <div className="md:col-span-5">
          <div className="border border-bone/15 p-6 space-y-5">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-copper">
              <BadgeCheck className="w-4 h-4" />
              {t('travel.verifiedTitle')}
            </div>
            <p className="text-sm text-bone/70 leading-relaxed">
              {t('travel.verifiedBody')}
            </p>
          </div>
        </div>
      </section>

      {/* ── SEARCH & FILTER ───────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 pb-12">
        <div className="border-y border-bone/10 py-6 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3 flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-bone/40 shrink-0" />
            <label htmlFor="q" className="sr-only">{t('travel.searchLabel')}</label>
            <input
              id="q"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('travel.searchPlaceholder')}
              className="bg-transparent text-sm w-full py-2 focus:outline-none placeholder:text-bone/35 border-b border-transparent focus:border-bone/30 transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-4 py-2 text-xs uppercase tracking-wider border transition ${
                  category === c
                    ? 'bg-bone text-ink border-bone'
                    : 'border-bone/25 hover:border-bone/60'
                }`}
              >
                {FILTER_KEYS[c] ? t(FILTER_KEYS[c]) : c}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <SlidersHorizontal className="w-4 h-4 text-bone/40" />
            <label htmlFor="buon" className="sr-only">{t('travel.filterByBuon')}</label>
            <select
              id="buon"
              value={buon}
              onChange={(e) => setBuon(e.target.value)}
              className="bg-ink border border-bone/25 text-xs uppercase tracking-wider px-3 py-2 focus:outline-none focus:border-bone/60"
            >
              {BUON.map((b) => (
                // Buôn names are proper nouns; only "All buôn" is translated.
                <option key={b} value={b}>{FILTER_KEYS[b] ? t(FILTER_KEYS[b]) : b}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ── LISTINGS ──────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 pb-24">
        {loadState === 'loading' && (
          <div className="text-sm text-bone/50 py-20 text-center">{t('travel.loading')}</div>
        )}

        {loadState === 'error' && (
          <ApiErrorNotice />
        )}

        {loadState === 'ready' && (
          <>
            <div className="text-sm text-bone/50 mb-8">
              {t('travel.available', { count: shown.length })}
            </div>

            {shown.length === 0 ? (
              <div className="border border-dashed border-bone/20 py-20 text-center">
                <p className="font-display text-2xl mb-3">{t('travel.emptyTitle')}</p>
                <p className="text-sm text-bone/60 mb-6">
                  {t('travel.emptyBody')}
                </p>
                <button
                  onClick={() => { setCategory('All'); setBuon('All buôn'); setSearch(''); }}
                  className="text-sm text-amber underline underline-offset-4"
                >
                  {t('travel.clearFilters')}
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {shown.map((l) => {
                  const booking = bookings[l.id];
                  const perNight = l.unit === 'per night';
                  return (
                    <article
                      key={l.id}
                      className="group border border-bone/10 hover:border-bone/30 transition flex flex-col"
                    >
                      <ImageSlot
                        src={l.imageUrl}
                        ratio="aspect-[4/3]"
                        label={t('travel.photoLabel', { title: l.title, buon: l.provider.buon })}
                        className="border-0 border-b border-dashed"
                      />

                      <div className="p-6 flex flex-col flex-1">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <span className="text-[10px] uppercase tracking-[0.2em] text-copper">
                            {CATEGORY_KEYS[l.category] ? t(CATEGORY_KEYS[l.category]) : l.category}
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber">
                            <BadgeCheck className="w-3 h-3" />
                            {t('travel.verified')}
                          </span>
                        </div>

                        <h3 className="font-display text-xl font-medium leading-tight mb-3">
                          {l.title}
                        </h3>

                        <p className="text-sm text-bone/60 leading-relaxed mb-5 flex-1">
                          {l.blurb}
                        </p>

                        <dl className="text-xs text-bone/50 space-y-2 mb-5">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <dd>{t('travel.hostedBy', { name: l.provider.displayName, buon: l.provider.buon })}</dd>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 shrink-0" />
                            <dd>{l.duration}</dd>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="w-3 h-3 shrink-0" />
                            <dd>{l.groupSize}</dd>
                          </div>
                          <div className="flex items-center gap-2">
                            <Leaf className="w-3 h-3 shrink-0 text-copper" />
                            <dd>{t('travel.carbonEstimate', { rating: l.carbonRating })}</dd>
                          </div>
                        </dl>

                        {l.customs && (
                          <div className="border-t border-bone/10 pt-4 mb-4">
                            <p className="text-[11px] text-bone/45 leading-relaxed">
                              <span className="text-copper">House rule · </span>
                              {l.customs}
                            </p>
                          </div>
                        )}

                        <div className="mt-auto space-y-4">
                          {/* The price gets its own row. It used to share one
                              with the booking controls, which was fine while
                              those were a number box and a button — adding the
                              date picker pushed the row past the card width, and
                              the flex parent took the space out of the price,
                              wrapping it mid-figure. */}
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="font-display price-sm text-amber leading-none whitespace-nowrap">
                              {vnd(l.priceVnd)}
                            </div>
                            <div className="text-[11px] text-bone/40 whitespace-nowrap">{l.unit}</div>
                          </div>

                          <div>
                            {booking?.status === 'done' ? (
                              <span className="text-xs text-amber uppercase tracking-wider">
                                {t('travel.requested')}
                              </span>
                            ) : (
                              <div className="space-y-3">
                                <label className="sr-only" htmlFor={`checkin-${l.id}`}>
                                  {t('travel.arrivalDate')}
                                </label>
                                <input
                                  id={`checkin-${l.id}`}
                                  type="date"
                                  min={today}
                                  value={checkInFor(l)}
                                  onChange={(e) => setCheckIn(l, e.target.value)}
                                  className="w-full bg-transparent border border-bone/25 text-sm py-2 px-3 focus:outline-none focus:border-bone/60 [color-scheme:dark]"
                                />
                                <div className="flex items-stretch gap-3">
                                  <label className="sr-only" htmlFor={`qty-${l.id}`}>
                                    {perNight ? t('travel.nights') : t('travel.guests')}
                                  </label>
                                  <input
                                    id={`qty-${l.id}`}
                                    type="number"
                                    min={1}
                                    max={perNight ? 30 : 20}
                                    value={qtyFor(l)}
                                    onChange={(e) => setQty(l, Number(e.target.value))}
                                    className="w-16 shrink-0 bg-transparent border border-bone/25 text-sm text-center py-2 focus:outline-none focus:border-bone/60"
                                  />
                                  <button
                                    onClick={() => handleBook(l)}
                                    disabled={booking?.status === 'submitting'}
                                    className="group/btn flex-1 inline-flex items-center justify-center gap-2 bg-kteh hover:bg-kteh-hover disabled:opacity-50 px-5 py-3 text-sm transition"
                                  >
                                    {booking?.status === 'submitting' ? t('travel.sending') : t('travel.book')}
                                    <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {booking?.status === 'done' && booking.totalVnd != null && (
                            <ImpactReceipt
                              totalVnd={booking.totalVnd}
                              providerVnd={booking.providerPayoutVnd}
                              communityFundVnd={booking.communityFundVnd}
                              platformFeeVnd={booking.platformFeeVnd}
                              provider={l.provider.displayName}
                              status={booking.paymentStatus === 'PAID' ? 'confirmed' : 'awaiting'}
                              compact
                            />
                          )}
                          {booking?.status === 'done' && booking.payment && (
                            <div className="space-y-3 text-xs text-bone/70">
                              {booking.payment.qrUrl ? (
                                <div className="space-y-2">
                                  <p className="uppercase tracking-wider text-amber">
                                    {t('travel.payQrTitle')}
                                  </p>
                                  <img
                                    src={booking.payment.qrUrl}
                                    alt={t('travel.payQrTitle')}
                                    className="w-40 h-40 bg-white p-1"
                                  />
                                  <dl className="space-y-1 text-bone/60">
                                    <div className="flex justify-between gap-2">
                                      <dt>{t('travel.payBankName')}</dt>
                                      <dd className="font-mono">
                                        {booking.payment.bankId ?? 'TCB'}
                                      </dd>
                                    </div>
                                    {booking.payment.bankAccount ? (
                                      <div className="flex justify-between gap-2">
                                        <dt>{t('travel.payAccount')}</dt>
                                        <dd className="font-mono">{booking.payment.bankAccount}</dd>
                                      </div>
                                    ) : null}
                                    {booking.paymentRef || booking.payment.paymentRef ? (
                                      <div className="flex justify-between gap-2">
                                        <dt>{t('travel.payRef')}</dt>
                                        <dd className="font-mono">
                                          {booking.paymentRef ?? booking.payment.paymentRef}
                                        </dd>
                                      </div>
                                    ) : null}
                                    {booking.payment.amountVnd ? (
                                      <div className="flex justify-between gap-2">
                                        <dt>{t('travel.payAmount')}</dt>
                                        <dd className="font-mono text-amber">
                                          {vnd(booking.payment.amountVnd)}
                                        </dd>
                                      </div>
                                    ) : null}
                                  </dl>
                                  <p className="text-bone/45 leading-relaxed">
                                    {t('travel.payInstructions')}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-bone/50 leading-relaxed">
                                  {booking.payment.instructions}
                                </p>
                              )}
                              {booking.demoTxSigs?.length ? (
                                <div className="border border-sage/40 p-2 space-y-1 text-sage">
                                  <p>{t('travel.demoTokensSent')}</p>
                                  {booking.demoTxSigs.slice(0, 3).map((sig) => (
                                    <a
                                      key={sig}
                                      href={`https://explorer.solana.com/tx/${sig}?cluster=devnet`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="block underline font-mono text-[10px] break-all"
                                    >
                                      {t('travel.viewDemoTx')} · {String(sig).slice(0, 8)}…
                                    </a>
                                  ))}
                                </div>
                              ) : booking.paymentStatus === 'PAID' ? (
                                <p className="text-bone/45">{t('travel.demoTokensSkipped')}</p>
                              ) : booking.payment.qrUrl ? (
                                <p className="text-bone/40">{t('travel.demoTokensPending')}</p>
                              ) : null}
                            </div>
                          )}
                          {booking?.status === 'error' && (
                            <p className="text-xs text-amber">{booking.error}</p>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>

      {/* ── WHERE THE MONEY GOES ──────────────────── */}
      <section className="reveal-cinematic bg-bone text-ink">
        <div className="px-8 lg:px-12 xl:px-16 py-24 grid md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-5">
            <div className="text-xs uppercase tracking-[0.25em] text-kteh mb-6">
              {t('travel.splitEyebrow')}
            </div>
            <h2 className="font-display page-title-sm font-medium leading-[1.1] tracking-tight text-deep mb-8">
              {t('travel.splitHeading')}
            </h2>
            <p className="text-lg text-ink/70 leading-relaxed">
              {t('travel.splitBody')}
            </p>
            <div className="mt-8">
              <DemoWalletPanel tone="light" />
            </div>
          </div>

          <div className="md:col-span-7">
            {/* Proportional bar */}
            <div className="flex h-3 mb-10 overflow-hidden">
              <div className="bg-deep" style={{ width: '90%' }} />
              <div className="bg-copper" style={{ width: '3%' }} />
              <div className="bg-kteh" style={{ width: '7%' }} />
            </div>

            <div className="space-y-8">
              {split.map((s) => (
                <div key={s.who} className="flex items-baseline gap-6 border-b border-ink/10 pb-6">
                  <div className="font-display text-4xl font-medium text-deep w-24 shrink-0">
                    {s.pct}
                  </div>
                  <div>
                    <div className="font-display text-lg font-medium mb-1">{s.who}</div>
                    <p className="text-sm text-ink/60 leading-relaxed">{s.note}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-ink/45 mt-6 leading-relaxed">
              {t('travel.splitNote')}
            </p>
          </div>
        </div>
      </section>

      <div className="h-3 textile" />

      {/* ── HANDOFF ───────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-20 flex flex-wrap items-center justify-between gap-8">
        <div className="max-w-xl">
          <h2 className="font-display text-3xl md:text-4xl font-medium leading-tight mb-3">
            {t('travel.handoffHeading')}
          </h2>
          <p className="text-bone/70">
            {t('travel.handoffBody')}
          </p>
        </div>
        <a
          href="#marketplace"
          className="group inline-flex items-center gap-3 bg-kteh hover:bg-kteh-hover px-8 py-4 transition"
        >
          {t('travel.handoffCta')}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
        </a>
      </section>
    </div>
  );
}
