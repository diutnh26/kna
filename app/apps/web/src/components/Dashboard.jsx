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
    PENDING: { label: t('dashboard.statusPending'), cls: 'text-[#B87333] border-[#B87333]/40' },
    CONFIRMED: { label: t('dashboard.statusConfirmed'), cls: 'text-[#E8A33D] border-[#E8A33D]/40' },
    COMPLETED: { label: t('dashboard.statusCompleted'), cls: 'text-[#8FA37B] border-[#8FA37B]/40' },
    CANCELLED: { label: t('dashboard.statusCancelled'), cls: 'text-[#F5EDDD]/40 border-[#F5EDDD]/20' },
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
    <div className="min-h-screen bg-[#1A1614] text-[#F5EDDD] font-body antialiased">
      <Navbar active="dashboard" theme="dark" />

      <section className="px-8 lg:px-12 xl:px-16 py-20 md:py-24 max-w-6xl">
        <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-[#B87333] mb-8">
          <span className="h-px w-12 bg-[#B87333]" />
          <span>{t('dashboard.eyebrow')}</span>
        </div>
        <h1 className="font-display page-title font-medium leading-[1.05] tracking-tight mb-6">
          {data ? data.provider.displayName : t('dashboard.fallbackTitle')}
        </h1>
        {data && (
          <p className="text-lg text-[#F5EDDD]/70 max-w-2xl leading-relaxed flex items-center gap-3">
            <MapPin className="w-4 h-4 shrink-0" />
            {data.provider.buon}
            {data.provider.verified && (
              <span className="inline-flex items-center gap-1.5 text-sm text-[#E8A33D]">
                <BadgeCheck className="w-4 h-4" />
                {t('dashboard.verified')}
              </span>
            )}
          </p>
        )}
      </section>

      {!isAuthenticated && (
        <section className="px-8 lg:px-12 xl:px-16 pb-24">
          <div className="border border-dashed border-[#F5EDDD]/20 py-16 text-center">
            <p className="font-display text-2xl mb-4">{t('dashboard.signInPrompt')}</p>
            <button
              onClick={openAuthModal}
              className="bg-[#C8302E] hover:bg-[#A82826] px-6 py-3 text-sm uppercase tracking-wider transition"
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
          <div className="border border-dashed border-[#F5EDDD]/20 py-16 px-8 text-center">
            <p className="font-display text-2xl mb-3">{t('dashboard.noProviderTitle')}</p>
            <p className="text-sm text-[#F5EDDD]/60 max-w-lg mx-auto leading-relaxed">
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
        <section className="px-8 lg:px-12 xl:px-16 pb-20 max-w-6xl">
          <h2 className="font-display text-3xl font-medium mb-2">
            {t('dashboard.queueTitle')}
            <span className="text-[#B87333] ml-3 text-2xl">{pending?.length ?? 0}</span>
          </h2>
          <p className="text-sm text-[#F5EDDD]/50 mb-8 max-w-2xl leading-relaxed">
            {t('dashboard.queueIntro')}
          </p>

          {error && <p className="text-sm text-[#E8A33D] mb-6">{error}</p>}

          {pending?.length === 0 ? (
            <div className="border border-dashed border-[#F5EDDD]/20 py-12 text-center text-sm text-[#F5EDDD]/60">
              {t('dashboard.queueEmpty')}
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
                      {t('dashboard.arriving', { date: dmy(b.checkIn), count: b.nights })}
                    </p>
                    <p className="text-xs text-[#F5EDDD]/45">
                      {b.guest.fullName} ({b.guest.email}) ·{' '}
                      {t('dashboard.guest', { count: b.guests })} ·{' '}
                      {t('dashboard.requested', { date: dmy(b.createdAt) })}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-display price-sm text-[#E8A33D] leading-none mb-1">
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
                            {t('dashboard.confirm')}
                    </button>
                    <button
                      onClick={() => decide(b, 'decline')}
                      disabled={busyId === b.id}
                      className="inline-flex items-center gap-2 border border-[#C8302E] text-[#C8302E] hover:bg-[#C8302E] hover:text-[#F5EDDD] disabled:opacity-50 px-5 py-3 text-sm transition"
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
          <section className="bg-[#F5EDDD] text-[#1A1614]">
            <div className="px-8 lg:px-12 xl:px-16 py-20">
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-[#C8302E] mb-8">
                <Wallet className="w-4 h-4" />
                {t('dashboard.earningsEyebrow')}
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-6">
                <div>
                  <div className="font-display price-lg font-medium text-[#6B1A1A] mb-1">
                    {vnd(totals.bookingEarnedVnd + totals.marketplaceEarnedVnd)}
                  </div>
                  <p className="text-sm text-[#1A1614]/60">{t('dashboard.yours')}</p>
                </div>
                <div>
                  <div className="font-display price-lg font-medium text-[#B87333] mb-1">
                    {vnd(totals.bookingFundVnd)}
                  </div>
                  <p className="text-sm text-[#1A1614]/60">{t('dashboard.toFund')}</p>
                </div>
                <div>
                  <div className="font-display price-lg font-medium text-[#1A1614]/70 mb-1">
                    {vnd(totals.bookingPlatformVnd)}
                  </div>
                  <p className="text-sm text-[#1A1614]/60">{t('dashboard.platformCut')}</p>
                </div>
                <div>
                  <div className="font-display text-4xl font-medium text-[#1A1614]/70 mb-1">
                    {totals.pendingBookings}
                  </div>
                  <p className="text-sm text-[#1A1614]/60">
                    {t('dashboard.awaiting', { count: totals.pendingBookings })}
                  </p>
                </div>
              </div>

              <p className="text-xs text-[#1A1614]/50 leading-relaxed max-w-2xl">
                {t('dashboard.earningsNote')}
              </p>
            </div>
          </section>

          {/* ── BOOKINGS ─────────────────────────────── */}
          <section className="px-8 lg:px-12 xl:px-16 py-20 max-w-6xl">
            <h2 className="font-display text-3xl font-medium mb-8">{t('dashboard.yourBookings')}</h2>

            {data.bookings.length === 0 ? (
              <p className="text-sm text-[#F5EDDD]/60 border border-dashed border-[#F5EDDD]/20 py-12 text-center">
                {t('dashboard.noBookings')}
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
                          {b.guestName} · {t('dashboard.guest', { count: b.guests })} ·{' '}
                          {t('dashboard.arriving', { date: dmy(b.checkIn), count: b.nights })}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono price-xs text-[#E8A33D]">
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
                      <div className="font-mono price-xs text-[#E8A33D]">{vnd(o.earnedVnd)}</div>
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
