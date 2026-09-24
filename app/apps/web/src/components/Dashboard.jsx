import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Clock, MapPin, Wallet } from 'lucide-react';
import Navbar from './Navbar';
import { api } from '../lib/api';
import { useAuth } from '../context/useAuth';
import ApiErrorNotice from './ApiErrorNotice';
import { OperatorWalletBar } from '../wallet/WalletConnect';
import ProviderCalendar from './ProviderCalendar';
import ProviderCatalog from './ProviderCatalog';
import DemoWalletPanel from './DemoWalletPanel';
import DemoTxHistory from './DemoTxHistory';

const vnd = (n) => n.toLocaleString('vi-VN') + ' ₫';
const dmy = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });


/**
 * Two audiences, one screen:
 *
 *  - a provider sees their own bookings and exactly what reached them;
 *  - a coordinator sees the operator tools (wallet, attestations, demo
 *    balances). There is no booking queue any more: providers open their
 *    calendars, and guests book open days instantly.
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
    UNPAID: { label: t('dashboard.statusUnpaid'), cls: 'text-kteh border-kteh/50' },
    CANCELLED: { label: t('dashboard.statusCancelled'), cls: 'text-bone/40 border-bone/20' },
  };
  const { user, token, isAuthenticated, openAuthModal } = useAuth();
  const [data, setData] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [reload, setReload] = useState(0);

  const mayCoordinate = Boolean(
    user && (user.role === 'ADMIN' || user.role === 'COORDINATOR' || user.isCommitteeMember)
  );

  const fetchDashboard = useCallback(
    () => (user?.provider ? api.providerDashboard(token) : Promise.resolve(null)),
    [token, user?.provider]
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    fetchDashboard()
      .then((dashboard) => {
        if (cancelled) return;
        setData(dashboard);
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, fetchDashboard, reload]);

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
        <section className="px-8 lg:px-12 xl:px-16 pb-6 max-w-6xl space-y-6">
          <OperatorWalletBar />
          {!data ? (
            <div className="space-y-5">
              <DemoWalletPanel />
              <DemoTxHistory />
            </div>
          ) : null}
        </section>
      )}

      {/* ── PROVIDER EARNINGS ─────────────────────── */}
      {data && (
        <>
          <section className="px-8 lg:px-12 xl:px-16 py-12">
            <ProviderCatalog
              provider={data.provider}
              listings={data.listings}
              products={data.products}
              onChanged={() => setReload((n) => n + 1)}
            />
          </section>
          <section className="px-8 lg:px-12 xl:px-16 pb-12 max-w-6xl space-y-5">
            <ProviderCalendar key={data.listings.map((l) => l.id).join()} listings={data.listings} />
          </section>
          <section className="px-8 lg:px-12 xl:px-16 pb-12 max-w-6xl space-y-5">
            <DemoWalletPanel />
            <DemoTxHistory />
          </section>

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
                        {b.demoTxSigs?.length ? (
                          <div className="mt-2 space-y-1 text-left">
                            {b.demoTxSigs.slice(0, 3).map((sig) => (
                              <a
                                key={sig}
                                href={`https://explorer.solana.com/tx/${sig}?cluster=devnet`}
                                target="_blank"
                                rel="noreferrer"
                                className="block text-[10px] underline text-[#8FA37B] font-mono"
                              >
                                {t('travel.viewDemoTx')} · {String(sig).slice(0, 8)}…
                              </a>
                            ))}
                          </div>
                        ) : null}
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
