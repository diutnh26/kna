import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Check, Clock, MapPin, Wallet, X } from 'lucide-react';
import Navbar from './Navbar';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../context/useAuth';
import ApiErrorNotice from './ApiErrorNotice';

const vnd = (n) => n.toLocaleString('vi-VN') + ' ₫';
const dmy = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const BOOKING_STATUS = {
  PENDING: { label: 'Awaiting confirmation', cls: 'text-[#B87333] border-[#B87333]/40' },
  CONFIRMED: { label: 'Confirmed', cls: 'text-[#E8A33D] border-[#E8A33D]/40' },
  COMPLETED: { label: 'Completed', cls: 'text-[#8FBE95] border-[#8FBE95]/40' },
  CANCELLED: { label: 'Cancelled', cls: 'text-[#C8302E] border-[#C8302E]/50' },
};

/**
 * Two audiences, one screen:
 *
 *  - a provider sees their own bookings and exactly what reached them;
 *  - a coordinator sees the queue of bookings waiting to be confirmed
 *    with a household by hand, which is the human step the Phase 1
 *    concierge MVP is built around.
 *
 * Someone can be both, and then they see both.
 */
export default function Dashboard() {
  const { user, token, isAuthenticated, openAuthModal } = useAuth();
  const [data, setData] = useState(null);
  const [pending, setPending] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [loadState, setLoadState] = useState('loading');

  const mayCoordinate = Boolean(
    user && (user.role === 'ADMIN' || user.role === 'COORDINATOR' || user.isCommitteeMember)
  );

  const fetchAll = useCallback(async () => {
    const [dashboard, queue] = await Promise.all([
      user?.provider ? api.providerDashboard(token) : Promise.resolve(null),
      mayCoordinate ? api.pendingBookings(token) : Promise.resolve(null),
    ]);
    return { dashboard, queue };
  }, [token, user?.provider, mayCoordinate]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    fetchAll()
      .then(({ dashboard, queue }) => {
        if (cancelled) return;
        setData(dashboard);
        setPending(queue);
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, fetchAll]);

  async function decide(booking, decision) {
    setError('');
    setBusyId(booking.id);
    try {
      await api.decideBooking(booking.id, { decision }, token);
      const { dashboard, queue } = await fetchAll();
      setData(dashboard);
      setPending(queue);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record that. Try again.');
    } finally {
      setBusyId(null);
    }
  }

  const totals = data?.totals;

  return (
    <div className="min-h-screen bg-[#1A1614] text-[#F5EDDD] font-body antialiased">
      <Navbar active="dashboard" theme="dark" />

      <section className="px-8 lg:px-12 xl:px-16 py-20 md:py-24 max-w-6xl">
        <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-[#B87333] mb-8">
          <span className="h-px w-12 bg-[#B87333]" />
          <span>Your account</span>
        </div>
        <h1 className="font-display text-4xl md:text-6xl font-medium leading-[1.05] tracking-tight mb-6">
          {data ? data.provider.displayName : 'Dashboard'}
        </h1>
        {data && (
          <p className="text-lg text-[#F5EDDD]/70 max-w-2xl leading-relaxed flex items-center gap-3">
            <MapPin className="w-4 h-4 shrink-0" />
            {data.provider.buon}
            {data.provider.verified && (
              <span className="inline-flex items-center gap-1.5 text-sm text-[#E8A33D]">
                <BadgeCheck className="w-4 h-4" />
                Verified
              </span>
            )}
          </p>
        )}
      </section>

      {!isAuthenticated && (
        <section className="px-8 lg:px-12 xl:px-16 pb-24">
          <div className="border border-dashed border-[#F5EDDD]/20 py-16 text-center">
            <p className="font-display text-2xl mb-4">Sign in to see your account.</p>
            <button
              onClick={openAuthModal}
              className="bg-[#C8302E] hover:bg-[#A82826] px-6 py-3 text-sm uppercase tracking-wider transition"
            >
              Sign in
            </button>
          </div>
        </section>
      )}

      {isAuthenticated && loadState === 'error' && (
        <section className="px-8 lg:px-12 xl:px-16 pb-24">
          <ApiErrorNotice />
        </section>
      )}

      {isAuthenticated && loadState === 'ready' && !data && !mayCoordinate && (
        <section className="px-8 lg:px-12 xl:px-16 pb-24">
          <div className="border border-dashed border-[#F5EDDD]/20 py-16 px-8 text-center">
            <p className="font-display text-2xl mb-3">Nothing to manage here yet.</p>
            <p className="text-sm text-[#F5EDDD]/60 max-w-lg mx-auto leading-relaxed">
              This page is for hosts, guides, and makers listing on KNĂ. Becoming a provider means
              being verified by a community representative in your buôn.
            </p>
          </div>
        </section>
      )}

      {/* ── COORDINATION QUEUE ────────────────────── */}
      {isAuthenticated && loadState === 'ready' && mayCoordinate && (
        <section className="px-8 lg:px-12 xl:px-16 pb-20 max-w-6xl">
          <h2 className="font-display text-3xl font-medium mb-2">
            Bookings to confirm
            <span className="text-[#B87333] ml-3 text-2xl">{pending?.length ?? 0}</span>
          </h2>
          <p className="text-sm text-[#F5EDDD]/50 mb-8 max-w-2xl leading-relaxed">
            Check the dates with the household, then confirm here. Declining releases the booking
            and removes its entry from the public ledger, because no money moved.
          </p>

          {error && <p className="text-sm text-[#E8A33D] mb-6">{error}</p>}

          {pending?.length === 0 ? (
            <div className="border border-dashed border-[#F5EDDD]/20 py-12 text-center text-sm text-[#F5EDDD]/60">
              Nothing waiting. Every booking has been decided.
            </div>
          ) : (
            <div className="space-y-4">
              {pending?.map((b) => (
                <article
                  key={b.id}
                  className="border border-[#F5EDDD]/15 p-6 flex flex-wrap items-start gap-6"
                >
                  <div className="flex-1 min-w-[260px]">
                    <h3 className="font-display text-xl font-medium leading-tight mb-2">
                      {b.listing.title}
                    </h3>
                    <p className="text-sm text-[#F5EDDD]/60 mb-1">
                      {b.listing.provider.displayName} · {b.listing.provider.buon}
                    </p>
                    {/* The dates lead: this is the question the coordinator
                        has to put to the household, and it is the reason the
                        queue is ordered by arrival rather than by request. */}
                    <p className="text-sm text-[#E8A33D] mb-1">
                      Arriving {dmy(b.checkIn)} · {b.nights} {b.nights === 1 ? 'night' : 'nights'}
                    </p>
                    <p className="text-xs text-[#F5EDDD]/45">
                      {b.guest.fullName} ({b.guest.email}) · {b.guests}{' '}
                      {b.guests === 1 ? 'guest' : 'guests'} · requested {dmy(b.createdAt)}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-display text-2xl text-[#E8A33D] leading-none mb-1">
                      {vnd(b.totalVnd)}
                    </div>
                    <div className="text-[11px] text-[#F5EDDD]/40">
                      {vnd(b.providerPayoutVnd)} to the household
                    </div>
                  </div>

                  <div className="flex gap-3 shrink-0">
                    <button
                      onClick={() => decide(b, 'confirm')}
                      disabled={busyId === b.id}
                      className="inline-flex items-center gap-2 bg-[#3F6146] hover:bg-[#35543B] disabled:opacity-50 px-5 py-3 text-sm transition"
                    >
                      <Check className="w-4 h-4" />
                      Confirm
                    </button>
                    <button
                      onClick={() => decide(b, 'decline')}
                      disabled={busyId === b.id}
                      className="inline-flex items-center gap-2 border border-[#C8302E] text-[#C8302E] hover:bg-[#C8302E] hover:text-[#F5EDDD] disabled:opacity-50 px-5 py-3 text-sm transition"
                    >
                      <X className="w-4 h-4" />
                      Decline
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── PROVIDER EARNINGS ─────────────────────── */}
      {data && (
        <>
          <section className="bg-[#F5EDDD] text-[#1A1614]">
            <div className="px-8 lg:px-12 xl:px-16 py-20">
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-[#C8302E] mb-8">
                <Wallet className="w-4 h-4" />
                What has reached you
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-6">
                <div>
                  <div className="font-display text-4xl font-medium text-[#6B1A1A] mb-1">
                    {vnd(totals.bookingEarnedVnd + totals.marketplaceEarnedVnd)}
                  </div>
                  <p className="text-sm text-[#1A1614]/60">yours, from confirmed business</p>
                </div>
                <div>
                  <div className="font-display text-4xl font-medium text-[#B87333] mb-1">
                    {vnd(totals.bookingFundVnd)}
                  </div>
                  <p className="text-sm text-[#1A1614]/60">to the Community Fund from your bookings</p>
                </div>
                <div>
                  <div className="font-display text-4xl font-medium text-[#1A1614]/70 mb-1">
                    {vnd(totals.bookingPlatformVnd)}
                  </div>
                  <p className="text-sm text-[#1A1614]/60">platform commission on your bookings</p>
                </div>
                <div>
                  <div className="font-display text-4xl font-medium text-[#1A1614]/70 mb-1">
                    {totals.pendingBookings}
                  </div>
                  <p className="text-sm text-[#1A1614]/60">
                    {totals.pendingBookings === 1 ? 'booking' : 'bookings'} awaiting confirmation
                  </p>
                </div>
              </div>

              <p className="text-xs text-[#1A1614]/50 leading-relaxed max-w-2xl">
                Bookings still awaiting confirmation are not counted as earnings — nobody has agreed
                the dates yet. Every figure here also appears on the public ledger.
              </p>
            </div>
          </section>

          {/* ── BOOKINGS ─────────────────────────────── */}
          <section className="px-8 lg:px-12 xl:px-16 py-20 max-w-6xl">
            <h2 className="font-display text-3xl font-medium mb-8">Your bookings</h2>

            {data.bookings.length === 0 ? (
              <p className="text-sm text-[#F5EDDD]/60 border border-dashed border-[#F5EDDD]/20 py-12 text-center">
                No bookings yet.
              </p>
            ) : (
              <div className="space-y-3">
                {data.bookings.map((b) => {
                  const s = BOOKING_STATUS[b.status] ?? BOOKING_STATUS.PENDING;
                  return (
                    <article
                      key={b.id}
                      className="border border-[#F5EDDD]/10 p-5 flex flex-wrap items-center gap-5"
                    >
                      <span
                        className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] border px-3 py-1.5 shrink-0 ${s.cls}`}
                      >
                        {b.status === 'PENDING' && <Clock className="w-3 h-3" />}
                        {s.label}
                      </span>
                      <div className="flex-1 min-w-[220px]">
                        <div className="text-sm mb-1">{b.listingTitle}</div>
                        <div className="text-xs text-[#F5EDDD]/45">
                          {b.guestName} · {b.guests} {b.guests === 1 ? 'guest' : 'guests'} ·{' '}
                          arriving {dmy(b.checkIn)}, {b.nights}{' '}
                          {b.nights === 1 ? 'night' : 'nights'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono text-sm text-[#E8A33D]">
                          {vnd(b.providerPayoutVnd)}
                        </div>
                        <div className="text-[11px] text-[#F5EDDD]/40">
                          of {vnd(b.totalVnd)} · {vnd(b.communityFundVnd)} to the Fund
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── MARKETPLACE SALES ────────────────────── */}
          {data.orders.length > 0 && (
            <section className="px-8 lg:px-12 xl:px-16 pb-24 max-w-6xl">
              <h2 className="font-display text-3xl font-medium mb-8">Your sales</h2>
              <div className="space-y-3">
                {data.orders.map((o) => (
                  <article
                    key={o.id}
                    className="border border-[#F5EDDD]/10 p-5 flex flex-wrap items-center gap-5"
                  >
                    <div className="flex-1 min-w-[220px]">
                      <div className="text-sm mb-1">{o.productTitle}</div>
                      <div className="text-xs text-[#F5EDDD]/45">
                        ×{o.quantity} · {dmy(o.createdAt)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm text-[#E8A33D]">{vnd(o.earnedVnd)}</div>
                      <div className="text-[11px] text-[#F5EDDD]/40">of {vnd(o.grossVnd)} · 95%</div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
