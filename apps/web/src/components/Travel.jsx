import { useEffect, useState } from 'react';
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

const CATEGORIES = ['All', 'Stay', 'Guided walk', 'Craft session', 'Ceremony'];
const BUON = ['All buôn', 'Buôn Akô Dhông', 'Buôn Đôn', 'Buôn Trấp', 'Buôn Kli A'];

// UI label <-> API enum. The Listing.category column is an enum
// (STAY / GUIDED_WALK / ...); everything the guest sees is the label.
const CATEGORY_TO_API = {
  Stay: 'STAY',
  'Guided walk': 'GUIDED_WALK',
  'Craft session': 'CRAFT_SESSION',
  Ceremony: 'CEREMONY',
};
const CATEGORY_LABELS = {
  STAY: 'Stay',
  GUIDED_WALK: 'Guided walk',
  CRAFT_SESSION: 'Craft session',
  CEREMONY: 'Ceremony',
};

const SPLIT = [
  { pct: '90%', who: 'To the provider', note: 'Paid directly to the household or co-op that hosts you.' },
  { pct: '3%', who: 'To the Community Fund', note: 'Heritage work and conservation, allocated by the Community Governance Committee.' },
  { pct: '7%', who: 'To KNĂ', note: 'Runs the platform, verification, and provider training.' },
];

const vnd = (n) => n.toLocaleString('vi-VN') + ' ₫';

export default function Travel() {
  const [category, setCategory] = useState('All');
  const [buon, setBuon] = useState('All buôn');
  const [listings, setListings] = useState([]);
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'error'

  // bookings[listingId] = { qty, status: 'idle'|'submitting'|'done'|'error', error }
  const [bookings, setBookings] = useState({});
  const { isAuthenticated, token, openAuthModal } = useAuth();

  // Deliberately doesn't flip back to 'loading' on every filter change —
  // the previous results stay on screen (stale-while-revalidate) until the
  // new ones are in, so picking a filter doesn't flash an empty state.
  useEffect(() => {
    let cancelled = false;
    api
      .listings({
        category: category === 'All' ? undefined : CATEGORY_TO_API[category],
        buon: buon === 'All buôn' ? undefined : buon,
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
  }, [category, buon]);

  function qtyFor(listing) {
    return bookings[listing.id]?.qty ?? 1;
  }

  function setQty(listing, qty) {
    setBookings((b) => ({ ...b, [listing.id]: { ...b[listing.id], qty: Math.max(1, qty) } }));
  }

  async function handleBook(listing) {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    const qty = qtyFor(listing);
    const perNight = listing.unit === 'per night';
    setBookings((b) => ({ ...b, [listing.id]: { ...b[listing.id], qty, status: 'submitting', error: null } }));
    try {
      await api.createBooking(
        {
          listingId: listing.id,
          guests: perNight ? 1 : qty,
          nights: perNight ? qty : 1,
        },
        token
      );
      setBookings((b) => ({ ...b, [listing.id]: { ...b[listing.id], qty, status: 'done', error: null } }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not send that booking. Try again.';
      setBookings((b) => ({ ...b, [listing.id]: { ...b[listing.id], qty, status: 'error', error: message } }));
    }
  }

  const shown = listings;

  return (
    <div className="min-h-screen bg-[#1A1614] text-[#F5EDDD] font-body antialiased">
      <Navbar active="travel" theme="dark" />

      {/* ── OPENING ───────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-20 md:py-24 grid md:grid-cols-12 gap-12 items-end">
        <div className="md:col-span-7">
          <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-[#B87333] mb-8">
            <span className="h-px w-12 bg-[#B87333]" />
            <span>Experiences in Đắk Lắk</span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-medium leading-[1.05] tracking-tight mb-8">
            Every listing is somebody&rsquo;s home, work, or calendar.
          </h1>
          <p className="text-lg text-[#F5EDDD]/70 max-w-2xl leading-relaxed">
            Ê Đê households set their own prices, their own dates, and their own house rules.
            KNĂ verifies them, carries the booking, and shows you what reaches them.
          </p>
        </div>

        <div className="md:col-span-5">
          <div className="border border-[#F5EDDD]/15 p-6 space-y-5">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[#B87333]">
              <BadgeCheck className="w-4 h-4" />
              What verified means here
            </div>
            <p className="text-sm text-[#F5EDDD]/70 leading-relaxed">
              A community representative has visited the household, confirmed the person listing is
              the person hosting, and checked that the cultural content described is theirs to
              share. Verification is renewed each season.
            </p>
          </div>
        </div>
      </section>

      {/* ── SEARCH & FILTER ───────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 pb-12">
        <div className="border-y border-[#F5EDDD]/10 py-6 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3 flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-[#F5EDDD]/40 shrink-0" />
            <label htmlFor="q" className="sr-only">Search experiences</label>
            <input
              id="q"
              type="search"
              placeholder="Search a host, a buôn, or a craft"
              className="bg-transparent text-sm w-full py-2 focus:outline-none placeholder:text-[#F5EDDD]/35 border-b border-transparent focus:border-[#F5EDDD]/30 transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-4 py-2 text-xs uppercase tracking-wider border transition ${
                  category === c
                    ? 'bg-[#F5EDDD] text-[#1A1614] border-[#F5EDDD]'
                    : 'border-[#F5EDDD]/25 hover:border-[#F5EDDD]/60'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <SlidersHorizontal className="w-4 h-4 text-[#F5EDDD]/40" />
            <label htmlFor="buon" className="sr-only">Filter by buôn</label>
            <select
              id="buon"
              value={buon}
              onChange={(e) => setBuon(e.target.value)}
              className="bg-[#1A1614] border border-[#F5EDDD]/25 text-xs uppercase tracking-wider px-3 py-2 focus:outline-none focus:border-[#F5EDDD]/60"
            >
              {BUON.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ── LISTINGS ──────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 pb-24">
        {loadState === 'loading' && (
          <div className="text-sm text-[#F5EDDD]/50 py-20 text-center">Loading experiences…</div>
        )}

        {loadState === 'error' && (
          <div className="border border-dashed border-[#F5EDDD]/20 py-20 text-center">
            <p className="font-display text-2xl mb-3">Couldn&rsquo;t reach the KNĂ API.</p>
            <p className="text-sm text-[#F5EDDD]/60">
              Is <code className="text-[#E8A33D]">apps/api</code> running on{' '}
              <code className="text-[#E8A33D]">localhost:4000</code>?
            </p>
          </div>
        )}

        {loadState === 'ready' && (
          <>
            <div className="text-sm text-[#F5EDDD]/50 mb-8">
              {shown.length} {shown.length === 1 ? 'experience' : 'experiences'} available
            </div>

            {shown.length === 0 ? (
              <div className="border border-dashed border-[#F5EDDD]/20 py-20 text-center">
                <p className="font-display text-2xl mb-3">Nothing in that combination yet.</p>
                <p className="text-sm text-[#F5EDDD]/60 mb-6">
                  Only four buôn have onboarded so far. Try a wider filter.
                </p>
                <button
                  onClick={() => { setCategory('All'); setBuon('All buôn'); }}
                  className="text-sm text-[#E8A33D] underline underline-offset-4"
                >
                  Clear filters
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
                      className="group border border-[#F5EDDD]/10 hover:border-[#F5EDDD]/30 transition flex flex-col"
                    >
                      <ImageSlot
                        ratio="aspect-[4/3]"
                        label={`${l.title} — ${l.provider.buon}`}
                        className="border-0 border-b border-dashed"
                      />

                      <div className="p-6 flex flex-col flex-1">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <span className="text-[10px] uppercase tracking-[0.2em] text-[#B87333]">
                            {CATEGORY_LABELS[l.category] ?? l.category}
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#E8A33D]">
                            <BadgeCheck className="w-3 h-3" />
                            Verified
                          </span>
                        </div>

                        <h3 className="font-display text-xl font-medium leading-tight mb-3">
                          {l.title}
                        </h3>

                        <p className="text-sm text-[#F5EDDD]/60 leading-relaxed mb-5 flex-1">
                          {l.blurb}
                        </p>

                        <dl className="text-xs text-[#F5EDDD]/50 space-y-2 mb-5">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <dd>Hosted by {l.provider.displayName} · {l.provider.buon}</dd>
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
                            <Leaf className="w-3 h-3 shrink-0 text-[#B87333]" />
                            <dd>{l.carbonRating} carbon estimate</dd>
                          </div>
                        </dl>

                        {l.customs && (
                          <div className="border-t border-[#F5EDDD]/10 pt-4 mb-4">
                            <p className="text-[11px] text-[#F5EDDD]/45 leading-relaxed">
                              <span className="text-[#B87333]">House rule · </span>
                              {l.customs}
                            </p>
                          </div>
                        )}

                        <div className="mt-auto space-y-4">
                          <div className="flex items-end justify-between gap-4">
                            <div>
                              <div className="font-display text-2xl text-[#E8A33D] leading-none">
                                {vnd(l.priceVnd)}
                              </div>
                              <div className="text-[11px] text-[#F5EDDD]/40 mt-1">{l.unit}</div>
                            </div>

                            {booking?.status === 'done' ? (
                              <span className="text-xs text-[#E8A33D] uppercase tracking-wider">
                                Requested ✓
                              </span>
                            ) : (
                              <div className="flex items-center gap-3">
                                <label className="sr-only" htmlFor={`qty-${l.id}`}>
                                  {perNight ? 'Nights' : 'Guests'}
                                </label>
                                <input
                                  id={`qty-${l.id}`}
                                  type="number"
                                  min={1}
                                  value={qtyFor(l)}
                                  onChange={(e) => setQty(l, Number(e.target.value))}
                                  className="w-14 bg-transparent border border-[#F5EDDD]/25 text-sm text-center py-2 focus:outline-none focus:border-[#F5EDDD]/60"
                                />
                                <button
                                  onClick={() => handleBook(l)}
                                  disabled={booking?.status === 'submitting'}
                                  className="group/btn inline-flex items-center gap-2 bg-[#C8302E] hover:bg-[#A82826] disabled:opacity-50 px-5 py-3 text-sm transition"
                                >
                                  {booking?.status === 'submitting' ? 'Sending…' : 'Book'}
                                  <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition" />
                                </button>
                              </div>
                            )}
                          </div>

                          {booking?.status === 'done' && (
                            <p className="text-xs text-[#F5EDDD]/50 leading-relaxed">
                              A KNĂ coordinator confirms availability with {l.provider.displayName.split(' ')[0]} directly — you&rsquo;ll hear back shortly.
                            </p>
                          )}
                          {booking?.status === 'error' && (
                            <p className="text-xs text-[#E8A33D]">{booking.error}</p>
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
      <section className="bg-[#F5EDDD] text-[#1A1614]">
        <div className="px-8 lg:px-12 xl:px-16 py-24 grid md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-5">
            <div className="text-xs uppercase tracking-[0.25em] text-[#C8302E] mb-6">
              On every booking
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight text-[#6B1A1A] mb-8">
              The split is written into the contract, not the marketing.
            </h2>
            <p className="text-lg text-[#1A1614]/70 leading-relaxed">
              Every booking is computed the same way on the server and written to the public
              ledger the moment you book — see it on the Community page.
            </p>
          </div>

          <div className="md:col-span-7">
            {/* Proportional bar */}
            <div className="flex h-3 mb-10 overflow-hidden">
              <div className="bg-[#6B1A1A]" style={{ width: '90%' }} />
              <div className="bg-[#B87333]" style={{ width: '3%' }} />
              <div className="bg-[#C8302E]" style={{ width: '7%' }} />
            </div>

            <div className="space-y-8">
              {SPLIT.map((s) => (
                <div key={s.who} className="flex items-baseline gap-6 border-b border-[#1A1614]/10 pb-6">
                  <div className="font-display text-4xl font-medium text-[#6B1A1A] w-24 shrink-0">
                    {s.pct}
                  </div>
                  <div>
                    <div className="font-display text-lg font-medium mb-1">{s.who}</div>
                    <p className="text-sm text-[#1A1614]/60 leading-relaxed">{s.note}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-[#1A1614]/45 mt-6 leading-relaxed">
              Marketplace purchases use a different split: artisans keep 95%.
            </p>
          </div>
        </div>
      </section>

      <div className="h-3 textile" />

      {/* ── HANDOFF ───────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-20 flex flex-wrap items-center justify-between gap-8">
        <div className="max-w-xl">
          <h2 className="font-display text-3xl md:text-4xl font-medium leading-tight mb-3">
            Taking something home?
          </h2>
          <p className="text-[#F5EDDD]/70">
            The same households sell their work through the marketplace, with the same verification.
          </p>
        </div>
        <a
          href="#marketplace"
          className="group inline-flex items-center gap-3 bg-[#C8302E] hover:bg-[#A82826] px-8 py-4 transition"
        >
          Visit the marketplace
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
        </a>
      </section>
    </div>
  );
}
