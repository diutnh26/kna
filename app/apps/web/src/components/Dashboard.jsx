import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Check, Clock, MapPin, Wallet, X } from 'lucide-react';
import Navbar from './Navbar';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../context/useAuth';
import ApiErrorNotice from './ApiErrorNotice';
import { OperatorWalletBar } from '../wallet/WalletConnect';
import AttestationPanel from '../wallet/AttestationPanel';

const vnd = (n) => n.toLocaleString('vi-VN') + ' ₫';
const dmy = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });


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
  const { t } = useTranslation();
  // Status labels are built from t() rather than a module constant, so
  // they follow the language toggle instead of freezing at import time.
  const BOOKING_STATUS = {
    PENDING: { label: t('dashboard.statusPending'), cls: 'text-copper border-copper/40' },
    CONFIRMED: { label: t('dashboard.statusConfirmed'), cls: 'text-amber border-amber/40' },
    COMPLETED: { label: t('dashboard.statusCompleted'), cls: 'text-sage border-sage/40' },
    CANCELLED: { label: t('dashboard.statusCancelled'), cls: 'text-bone/40 border-bone/20' },
  };
  const { user, token, isAuthenticated, openAuthModal } = useAuth();
  const [data, setData] = useState(null);
  const [pending, setPending] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [loadState, setLoadState] = useState('loading');
  const [attestLedgerId, setAttestLedgerId] = useState(null);

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
      if (decision === 'confirm') {
        const entries = await api.ledger(20);
        const match = entries.find((e) => e.bookingId === booking.id);
        if (match) setAttestLedgerId(match.id);
      }
      const { dashboard, queue } = await fetchAll();
      setData(dashboard);
      setPending(queue);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('dashboard.decisionError'));
    } finally {
      setBusyId(null);
    }
  }

  const totals = data?.totals;

  return (
    <div className="min-h-screen bg-ink text-bone font-body antialiased">
      <Navbar active="dashboard" theme="dark" />

      {/* Full-bleed, matching Review and the earnings panel below, which
          was already unclamped — so the header and the queue were reading
          narrower than the panel they sit above. Padding is the only margin. */}
      <section className="px-8 lg:px-12 xl:px-16 py-20 md:py-24">
        <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-copper mb-8">
          <span className="h-px w-12 bg-copper" />
          <span>{t('dashboard.eyebrow')}</span>
        </div>
        <h1 className="font-display page-title font-medium leading-[1.05] tracking-tight mb-6">
          {data ? data.provider.displayName : t('dashboard.fallbackTitle')}
        </h1>
        {data && (
          <p className="text-lg text-bone/70 leading-relaxed flex items-center gap-3">
            <MapPin className="w-4 h-4 shrink-0" />
            {data.provider.buon}
            {data.provider.verified && (
              <span className="inline-flex items-center gap-1.5 text-sm text-amber">
                <BadgeCheck className="w-4 h-4" />
                {t('dashboard.verified')}
              </span>
            )}
          </p>
        )}
      </section>

      {!isAuthenticated && (
        <section className="px-8 lg:px-12 xl:px-16 pb-24">
          <div className="border border-dashed border-bone/20 py-16 text-center">
            <p className="font-display text-2xl mb-4">{t('dashboard.signInPrompt')}</p>
            <button
              onClick={openAuthModal}
              className="bg-kteh hover:bg-kteh-hover px-6 py-3 text-sm uppercase tracking-wider transition"
            >
              {t('dashboard.signIn')}
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
          <div className="border border-dashed border-bone/20 py-16 px-8 text-center">
            <p className="font-display text-2xl mb-3">{t('dashboard.noProviderTitle')}</p>
            <p className="text-sm text-bone/60 max-w-lg mx-auto leading-relaxed">
              {t('dashboard.noProviderBody')}
            </p>
          </div>
        </section>
      )}

      {isAuthenticated && loadState === 'ready' && mayCoordinate && (
        <section className="px-8 lg:px-12 xl:px-16 pb-6 max-w-6xl">
          <OperatorWalletBar />
          {attestLedgerId ? (
            <div className="mt-4">
              <AttestationPanel ledgerEntryId={attestLedgerId} token={token} />
            </div>
          ) : null}
        </section>
      )}

      {/* ── COORDINATION QUEUE ────────────────────── */}
      {isAuthenticated && loadState === 'ready' && mayCoordinate && (
        <section className="px-8 lg:px-12 xl:px-16 pb-20">
          <h2 className="font-display text-3xl font-medium mb-2">
            {t('dashboard.queueTitle')}
            <span className="text-copper ml-3 text-2xl">{pending?.length ?? 0}</span>
          </h2>
          <p className="text-sm text-bone/50 mb-8 leading-relaxed">
            {t('dashboard.queueIntro')}
          </p>

          {error && <p className="text-sm text-amber mb-6">{error}</p>}

          {pending?.length === 0 ? (
            <div className="border border-dashed border-bone/20 py-12 text-center text-sm text-bone/60">
              {t('dashboard.queueEmpty')}
            </div>
          ) : (
            <div className="space-y-4">
              {pending?.map((b) => (
                <article
                  key={b.id}
                  className="border border-bone/15 p-6 flex flex-wrap items-start gap-6"
                >
                  <div className="flex-1 min-w-[260px]">
                    <h3 className="font-display text-xl font-medium leading-tight mb-2">
                      {b.listing.title}
                    </h3>
                    <p className="text-sm text-bone/60 mb-1">
                      {b.listing.provider.displayName} · {b.listing.provider.buon}
                    </p>
                    {/* The dates lead: this is the question the coordinator
                        has to put to the household, and it is the reason the
                        queue is ordered by arrival rather than by request. */}
                    <p className="text-sm text-amber mb-1">
                      {t('dashboard.arriving', { date: dmy(b.checkIn), count: b.nights })}
                    </p>
                    <p className="text-xs text-bone/45">
                      {b.guest.fullName} ({b.guest.email}) ·{' '}
                      {t('dashboard.guest', { count: b.guests })} ·{' '}
                      {t('dashboard.requested', { date: dmy(b.createdAt) })}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-display price-sm text-amber leading-none mb-1">
                      {vnd(b.totalVnd)}
                    </div>
                    <div className="text-[11px] text-bone/40">
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
                            {t('dashboard.confirm')}
                    </button>
                    <button
                      onClick={() => decide(b, 'decline')}
                      disabled={busyId === b.id}
                      className="inline-flex items-center gap-2 border border-kteh text-kteh hover:bg-kteh hover:text-bone disabled:opacity-50 px-5 py-3 text-sm transition"
                    >
                      <X className="w-4 h-4" />
                      {t('dashboard.decline')}
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
          <section className="bg-bone text-ink">
            <div className="px-8 lg:px-12 xl:px-16 py-20">
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-kteh mb-8">
                <Wallet className="w-4 h-4" />
                {t('dashboard.earningsEyebrow')}
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-6">
                <div>
                  <div className="font-display price-lg font-medium text-deep mb-1">
                    {vnd(totals.bookingEarnedVnd + totals.marketplaceEarnedVnd)}
                  </div>
                  <p className="text-sm text-ink/60">{t('dashboard.yours')}</p>
                </div>
                <div>
                  <div className="font-display price-lg font-medium text-copper mb-1">
                    {vnd(totals.bookingFundVnd)}
                  </div>
                  <p className="text-sm text-ink/60">{t('dashboard.toFund')}</p>
                </div>
                <div>
                  <div className="font-display price-lg font-medium text-ink/70 mb-1">
                    {vnd(totals.bookingPlatformVnd)}
                  </div>
                  <p className="text-sm text-ink/60">{t('dashboard.platformCut')}</p>
                </div>
                <div>
                  <div className="font-display text-4xl font-medium text-ink/70 mb-1">
                    {totals.pendingBookings}
                  </div>
                  <p className="text-sm text-ink/60">
                    {t('dashboard.awaiting', { count: totals.pendingBookings })}
                  </p>
                </div>
              </div>

              <p className="text-xs text-ink/50 leading-relaxed">
                {t('dashboard.earningsNote')}
              </p>
            </div>
          </section>

          {/* ── BOOKINGS ─────────────────────────────── */}
          <section className="px-8 lg:px-12 xl:px-16 py-20">
            <h2 className="font-display text-3xl font-medium mb-8">{t('dashboard.yourBookings')}</h2>

            {data.bookings.length === 0 ? (
              <p className="text-sm text-bone/60 border border-dashed border-bone/20 py-12 text-center">
                {t('dashboard.noBookings')}
              </p>
            ) : (
              <div className="space-y-3">
                {data.bookings.map((b) => {
                  const s = BOOKING_STATUS[b.status] ?? BOOKING_STATUS.PENDING;
                  return (
                    <article
                      key={b.id}
                      className="border border-bone/10 p-5 flex flex-wrap items-center gap-5"
                    >
                      <span
                        className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] border px-3 py-1.5 shrink-0 ${s.cls}`}
                      >
                        {b.status === 'PENDING' && <Clock className="w-3 h-3" />}
                        {s.label}
                      </span>
                      <div className="flex-1 min-w-[220px]">
                        <div className="text-sm mb-1">{b.listingTitle}</div>
                        <div className="text-xs text-bone/45">
                          {b.guestName} · {t('dashboard.guest', { count: b.guests })} ·{' '}
                          {t('dashboard.arriving', { date: dmy(b.checkIn), count: b.nights })}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono price-xs text-amber">
                          {vnd(b.providerPayoutVnd)}
                        </div>
                        <div className="text-[11px] text-bone/40">
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
            <section className="px-8 lg:px-12 xl:px-16 pb-24">
              <h2 className="font-display text-3xl font-medium mb-8">Your sales</h2>
              <div className="space-y-3">
                {data.orders.map((o) => (
                  <article
                    key={o.id}
                    className="border border-bone/10 p-5 flex flex-wrap items-center gap-5"
                  >
                    <div className="flex-1 min-w-[220px]">
                      <div className="text-sm mb-1">{o.productTitle}</div>
                      <div className="text-xs text-bone/45">
                        ×{o.quantity} · {dmy(o.createdAt)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono price-xs text-amber">{vnd(o.earnedVnd)}</div>
                      <div className="text-[11px] text-bone/40">of {vnd(o.grossVnd)} · 95%</div>
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
