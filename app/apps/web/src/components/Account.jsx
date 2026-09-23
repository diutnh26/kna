import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wallet,
  ShoppingBag,
  CalendarDays,
  FileText,
  MapPin,
  Clock,
  Check,
  X,
  Sprout,
} from 'lucide-react';
import Navbar from './Navbar';
import ImageSlot from './ImageSlot';
import ApiErrorNotice from './ApiErrorNotice';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../context/useAuth';
import { GuestReceiptPanel } from '../wallet/AttestationPanel';
import DemoWalletPanel from './DemoWalletPanel';
import DemoTxHistory from './DemoTxHistory';

const vnd = (n) => n.toLocaleString('vi-VN') + ' ₫';
const dmy = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Status pill colours, keyed by the value the API actually returns. */
const STATUS_STYLE = {
  PENDING: 'text-copper border-copper/40',
  IN_REVIEW: 'text-copper border-copper/40',
  DRAFT: 'text-bone/40 border-bone/20',
  CONFIRMED: 'text-amber border-amber/40',
  PAID: 'text-amber border-amber/40',
  COMPLETED: 'text-sage border-sage/40',
  FULFILLED: 'text-sage border-sage/40',
  PUBLISHED: 'text-sage border-sage/40',
  CANCELLED: 'text-bone/40 border-bone/20',
  REJECTED: 'text-kteh border-kteh/50',
};

const KIND_ICON = { booking: CalendarDays, order: ShoppingBag, contribution: FileText };

/**
 * A person's own account.
 *
 * The summary at the top is the platform's central claim turned around to
 * face the individual: not "90% reaches households" as a policy, but "this
 * much of what *you* paid reached them" as a figure they can check against
 * their own receipts. That is the version of the argument a guest can
 * actually verify.
 *
 * It counts settled records only, for the same reason the public ledger
 * does. Here the error would flatter the visitor rather than the platform,
 * which is no better.
 */
export default function Account() {
  const { t } = useTranslation();
  // Project names come from the Carbon Journey's own locale data rather
  // than a second list here, so the two screens cannot drift into calling
  // the same project different things.
  const offsetProjectName = (id) =>
    t('carbon.projects', { returnObjects: true }).find((p) => p.id === id)?.name ?? id;
  const { isAuthenticated, openAuthModal, refreshUser, setToken } = useAuth();

  const [data, setData] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [filter, setFilter] = useState('all');

  const [form, setForm] = useState({ fullName: '', locale: 'en' });
  const [profileState, setProfileState] = useState({ busy: false, message: '', error: '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [pwState, setPwState] = useState({ busy: false, message: '', error: '' });

  const load = useCallback(async () => {
    const [account, timeline] = await Promise.all([api.account(), api.accountActivity()]);
    return { account, timeline };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    load()
      .then(({ account, timeline }) => {
        if (cancelled) return;
        setData(account);
        setActivity(timeline);
        setForm({ fullName: account.user.fullName, locale: account.user.locale });
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, load]);

  async function saveProfile(e) {
    e.preventDefault();
    setProfileState({ busy: true, message: '', error: '' });
    try {
      const updated = await api.updateAccount(form);
      setData(updated);
      setProfileState({ busy: false, message: t('account.saved'), error: '' });
      // The navbar greeting and the language both come from this record.
      await refreshUser();
    } catch (err) {
      setProfileState({
        busy: false,
        message: '',
        error: err instanceof ApiError ? err.message : t('account.saveError'),
      });
    }
  }

  async function submitPassword(e) {
    e.preventDefault();
    setPwState({ busy: true, message: '', error: '' });
    try {
      await api.changePassword(pw);
      // Cookies are rotated server-side; refresh in-memory user.
      setToken();
      setPw({ currentPassword: '', newPassword: '' });
      setPwState({ busy: false, message: t('account.passwordChanged'), error: '' });
    } catch (err) {
      setPwState({
        busy: false,
        message: '',
        error: err instanceof ApiError ? err.message : t('account.passwordError'),
      });
    }
  }

  const shown = activity.filter((row) => {
    if (filter === 'all') return true;
    if (filter === 'bookings') return row.kind === 'booking';
    if (filter === 'orders') return row.kind === 'order';
    // An offset is not its own row — it rides on the booking that paid
    // for it — so this filter narrows to the bookings carrying one.
    if (filter === 'offsets') return row.kind === 'booking' && row.offset;
    return row.kind === 'contribution';
  });

  const field =
    'w-full bg-transparent border border-bone/25 px-4 py-3 text-sm focus:outline-none focus:border-bone/60';
  const legend = 'block text-xs uppercase tracking-[0.2em] text-copper mb-3';

  return (
    <div className="min-h-screen bg-ink text-bone font-body antialiased">
      <Navbar active="account" theme="dark" />

      <section className="px-8 lg:px-12 xl:px-16 py-20 md:py-24 max-w-6xl">
        <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-copper mb-8">
          <span className="h-px w-12 bg-copper" />
          <span>{t('account.eyebrow')}</span>
        </div>
        <h1 className="font-display page-title font-medium leading-[1.05] tracking-tight mb-6">
          {t('account.title')}
        </h1>
        <p className="text-lg text-bone/70 max-w-2xl leading-relaxed">{t('account.intro')}</p>
        {data && (
          <p className="text-sm text-bone/45 mt-6">
            {t('account.memberSince', { date: dmy(data.user.memberSince) })}
          </p>
        )}
      </section>

      {!isAuthenticated && (
        <section className="px-8 lg:px-12 xl:px-16 pb-24">
          <div className="border border-dashed border-bone/20 py-16 text-center">
            <p className="font-display text-2xl mb-4">{t('account.signInPrompt')}</p>
            <button
              onClick={openAuthModal}
              className="bg-kteh hover:bg-kteh-hover px-6 py-3 text-sm uppercase tracking-wider transition"
            >
              {t('account.signIn')}
            </button>
          </div>
        </section>
      )}

      {isAuthenticated && loadState === 'ready' && (
        <section className="px-8 lg:px-12 xl:px-16 pb-12 max-w-6xl space-y-5">
          <GuestReceiptPanel />
          <DemoWalletPanel />
          <DemoTxHistory />
        </section>
      )}

      {isAuthenticated && loadState === 'loading' && (
        <section className="px-8 lg:px-12 xl:px-16 pb-24 text-sm text-bone/50">
          {t('account.loading')}
        </section>
      )}

      {isAuthenticated && loadState === 'error' && (
        <section className="px-8 lg:px-12 xl:px-16 pb-24">
          <ApiErrorNotice />
        </section>
      )}

      {isAuthenticated && loadState === 'ready' && data && (
        <>
          {/* ── MONEY SUMMARY (role-aware) ──────────────────── */}
          <section className="bg-bone text-ink">
            <div className="px-8 lg:px-12 xl:px-16 py-20">
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-kteh mb-8">
                <Wallet className="w-4 h-4" />
                {data.moneyView === 'staff'
                  ? t('account.staffEyebrow')
                  : data.moneyView === 'provider'
                    ? t('account.providerEyebrow')
                    : t('account.summaryEyebrow')}
              </div>

              {data.moneyView === 'staff' && data.staffMoney ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-6">
                  <div>
                    <div className="font-display price-lg font-medium text-deep mb-1">
                      {vnd(data.staffMoney.settledBookingsVnd)}
                    </div>
                    <p className="text-sm text-ink/60">{t('account.staffSettled')}</p>
                  </div>
                  <div>
                    <div className="font-display price-lg font-medium text-copper mb-1">
                      {vnd(data.staffMoney.toProvidersVnd)}
                    </div>
                    <p className="text-sm text-ink/60">{t('account.staffToProviders')}</p>
                  </div>
                  <div>
                    <div className="font-display price-lg font-medium text-ink/70 mb-1">
                      {vnd(data.staffMoney.toFundVnd)}
                    </div>
                    <p className="text-sm text-ink/60">{t('account.staffToFund')}</p>
                  </div>
                  <div>
                    <div className="font-display price-lg font-medium text-[#4F5D3A] mb-1">
                      {data.staffMoney.paidWithDemo}
                    </div>
                    <p className="text-sm text-ink/60">{t('account.staffDemoPaid')}</p>
                    {data.staffMoney.awaitingPayment > 0 && (
                      <p className="text-xs text-ink/45 mt-1">
                        {t('account.staffAwaiting', { count: data.staffMoney.awaitingPayment })}
                      </p>
                    )}
                  </div>
                </div>
              ) : data.moneyView === 'provider' && data.providerMoney ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-6">
                  <div>
                    <div className="font-display price-lg font-medium text-deep mb-1">
                      {vnd(data.providerMoney.earnedVnd)}
                    </div>
                    <p className="text-sm text-ink/60">{t('account.providerEarned')}</p>
                  </div>
                  <div>
                    <div className="font-display price-lg font-medium text-copper mb-1">
                      {vnd(data.providerMoney.fundVnd)}
                    </div>
                    <p className="text-sm text-ink/60">{t('account.providerFund')}</p>
                  </div>
                  <div>
                    <div className="font-display price-lg font-medium text-ink/70 mb-1">
                      {vnd(data.providerMoney.platformVnd)}
                    </div>
                    <p className="text-sm text-ink/60">{t('account.providerPlatform')}</p>
                  </div>
                  <div>
                    <div className="font-display price-lg font-medium text-[#4F5D3A] mb-1">
                      {data.providerMoney.bookings}
                    </div>
                    <p className="text-sm text-ink/60">{t('account.providerBookings')}</p>
                    {data.providerMoney.pending > 0 && (
                      <p className="text-xs text-ink/45 mt-1">
                        {t('account.providerPending', { count: data.providerMoney.pending })}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-6">
                  <div>
                    <div className="font-display price-lg font-medium text-deep mb-1">
                      {vnd(data.totals.spentVnd)}
                    </div>
                    <p className="text-sm text-ink/60">{t('account.spent')}</p>
                  </div>
                  <div>
                    <div className="font-display price-lg font-medium text-copper mb-1">
                      {vnd(data.totals.toProvidersVnd)}
                    </div>
                    <p className="text-sm text-ink/60">{t('account.toProviders')}</p>
                  </div>
                  <div>
                    <div className="font-display price-lg font-medium text-ink/70 mb-1">
                      {vnd(data.totals.toCommunityFundVnd)}
                    </div>
                    <p className="text-sm text-ink/60">{t('account.toFund')}</p>
                  </div>
                  <div>
                    <div className="font-display price-lg font-medium text-[#4F5D3A] mb-1">
                      {vnd(data.totals.toOffsetProjectsVnd)}
                    </div>
                    <p className="text-sm text-ink/60">{t('account.toOffsets')}</p>
                    {data.totals.offsetKgCo2e > 0 && (
                      <p className="text-xs text-ink/45 mt-1">
                        {t('account.offsetKg', { count: data.totals.offsetKgCo2e })}
                      </p>
                    )}
                    {data.totals.offsetsJoining > 0 && (
                      <p className="text-xs text-[#4F5D3A] mt-1">
                        {t('account.joiningCount', { count: data.totals.offsetsJoining })}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <p className="text-xs text-ink/50 leading-relaxed max-w-2xl">
                {data.moneyView === 'staff'
                  ? t('account.staffSettledOnly')
                  : data.moneyView === 'provider'
                    ? t('account.providerSettledOnly')
                    : t('account.settledOnly')}
              </p>
              {/* Guest spend still shown under provider/staff so personal trips are visible */}
              {(data.moneyView === 'provider' || data.moneyView === 'staff') &&
              data.totals.spentVnd > 0 ? (
                <p className="text-xs text-ink/45 mt-3">
                  {t('account.alsoAsGuest', { amount: vnd(data.totals.spentVnd) })}
                </p>
              ) : null}
            </div>
          </section>

          {/* ── DETAILS ───────────────────────────────── */}
          <section className="px-8 lg:px-12 xl:px-16 py-20 max-w-6xl grid md:grid-cols-2 gap-12">
            <form onSubmit={saveProfile}>
              <h2 className="font-display text-3xl font-medium mb-8">
                {t('account.detailsTitle')}
              </h2>

              <label className={legend} htmlFor="fullName">
                {t('account.fullName')}
              </label>
              <input
                id="fullName"
                className={`${field} mb-6`}
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              />

              <label className={legend} htmlFor="email">
                {t('account.email')}
              </label>
              <input
                id="email"
                className={`${field} opacity-50 cursor-not-allowed`}
                value={data.user.email}
                readOnly
                disabled
              />
              <p className="text-xs text-bone/40 mt-2 mb-6 leading-relaxed">
                {t('account.emailFixed')}
              </p>

              <label className={legend} htmlFor="locale">
                {t('account.language')}
              </label>
              <select
                id="locale"
                className={`${field} mb-8 bg-ink`}
                value={form.locale}
                onChange={(e) => setForm((f) => ({ ...f, locale: e.target.value }))}
              >
                <option value="en">{t('account.english')}</option>
                <option value="vi">{t('account.vietnamese')}</option>
              </select>

              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={profileState.busy}
                  className="bg-kteh hover:bg-kteh-hover disabled:opacity-50 px-6 py-3 text-sm uppercase tracking-wider transition"
                >
                  {profileState.busy ? t('account.saving') : t('account.save')}
                </button>
                {profileState.message && (
                  <span className="text-sm text-sage">{profileState.message}</span>
                )}
                {profileState.error && (
                  <span className="text-sm text-amber">{profileState.error}</span>
                )}
              </div>
            </form>

            <form onSubmit={submitPassword}>
              <h2 className="font-display text-3xl font-medium mb-4">
                {t('account.passwordTitle')}
              </h2>
              <p className="text-sm text-bone/55 leading-relaxed mb-8">
                {t('account.passwordNote')}
              </p>

              <label className={legend} htmlFor="currentPassword">
                {t('account.currentPassword')}
              </label>
              <input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                className={`${field} mb-6`}
                value={pw.currentPassword}
                onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))}
              />

              <label className={legend} htmlFor="newPassword">
                {t('account.newPassword')}
              </label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                className={`${field} mb-8`}
                value={pw.newPassword}
                onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))}
              />

              <div className="flex items-center gap-4 flex-wrap">
                <button
                  type="submit"
                  disabled={pwState.busy}
                  className="border border-bone/30 hover:border-bone/70 disabled:opacity-50 px-6 py-3 text-sm uppercase tracking-wider transition"
                >
                  {pwState.busy ? t('account.changing') : t('account.changePassword')}
                </button>
                {pwState.message && (
                  <span className="text-sm text-sage">{pwState.message}</span>
                )}
                {pwState.error && <span className="text-sm text-amber">{pwState.error}</span>}
              </div>
            </form>
          </section>

          {/* ── ACTIVITY ──────────────────────────────── */}
          {/* Full width, unlike the two sections above it. The header row
              puts a title and five filter buttons on one line, and each row
              below carries a thumbnail, a title, a status pill and three
              money figures — both want the whole measure. Padding is the
              only margin, matching Review and Dashboard. */}
          <section className="px-8 lg:px-12 xl:px-16 pb-24">
            <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
              <h2 className="font-display text-3xl font-medium">{t('account.activityTitle')}</h2>
              <div className="flex flex-wrap gap-2">
                {[
                  ['all', t('account.filterAll')],
                  ['bookings', t('account.filterBookings')],
                  ['orders', t('account.filterOrders')],
                  ['offsets', t('account.filterOffsets')],
                  ['contributions', t('account.filterContributions')],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`px-4 py-2 text-xs uppercase tracking-wider border transition ${
                      filter === key
                        ? 'bg-bone text-ink border-bone'
                        : 'border-bone/25 hover:border-bone/60'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {shown.length === 0 ? (
              <div className="border border-dashed border-bone/20 py-16 text-center">
                <p className="font-display text-2xl mb-2">
                  {filter === 'offsets' ? t('account.offsetsNone') : t('account.activityEmpty')}
                </p>
                <p className="text-sm text-bone/60">
                  {filter === 'offsets' ? t('account.offsetsNoneBody') : t('account.activityEmptyBody')}
                </p>
                {filter === 'offsets' && (
                  <a
                    href="#carbon"
                    className="inline-block mt-4 text-sm text-amber underline underline-offset-4"
                  >
                    {t('account.openTracker')}
                  </a>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {shown.map((row) => {
                  const Icon = KIND_ICON[row.kind] ?? Clock;
                  const pill = STATUS_STYLE[row.status] ?? STATUS_STYLE.PENDING;
                  return (
                    <article
                      key={`${row.kind}-${row.id}`}
                      className="border border-bone/15 p-6 flex flex-wrap items-start gap-6"
                    >
                      <ImageSlot
                        src={row.imageUrl}
                        ratio="aspect-square"
                        label={row.title}
                        showCaption={false}
                        className="w-20 shrink-0"
                      />

                      <div className="flex-1 min-w-[260px]">
                        <div className="flex items-center gap-3 mb-2">
                          <Icon className="w-3.5 h-3.5 text-copper shrink-0" />
                          <span className="text-[10px] uppercase tracking-[0.2em] text-copper">
                            {t(`account.kind${row.kind[0].toUpperCase()}${row.kind.slice(1)}`)}
                          </span>
                          <span
                            className={`text-[10px] uppercase tracking-wider border px-2 py-0.5 ${pill}`}
                          >
                            {t(`account.status${row.status}`, row.status)}
                          </span>
                        </div>

                        <h3 className="font-display text-xl font-medium leading-tight mb-2">
                          {row.title}
                        </h3>

                        {row.kind === 'booking' && (
                          <p className="text-sm text-amber mb-1">
                            {t('account.arriving', { date: dmy(row.checkIn), count: row.nights })} ·{' '}
                            {t('account.guests', { count: row.guests })}
                          </p>
                        )}
                        {row.kind === 'order' && (
                          <p className="text-sm text-bone/60 mb-1">
                            {t('account.items', { count: row.itemCount })}
                          </p>
                        )}

                        {row.from && (
                          <p className="text-xs text-bone/45 flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {t('account.from', { name: row.from })}
                            {row.buon ? ` · ${row.buon}` : ''}
                          </p>
                        )}

                        {row.kind === 'booking' && row.offset && (
                          <div className="mt-3 border-l-2 border-sage/50 pl-3">
                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-sage mb-1">
                              <Sprout className="w-3 h-3 shrink-0" />
                              {t('account.offsetTitle')}
                            </div>
                            <p className="text-sm text-bone/70">
                              {t('account.offsetLine', {
                                kg: row.offset.kgCo2e.toLocaleString('vi-VN'),
                                project: offsetProjectName(row.offset.projectId),
                              })}
                              {/* Only a donation has an amount; a day's work
                                  and a place left forward both cost nothing,
                                  and printing 0 ₫ beside them would read as
                                  a failed payment. */}
                              {row.offset.amountVnd > 0 && (
                                <span className="text-bone/45"> · {vnd(row.offset.amountVnd)}</span>
                              )}
                            </p>
                            {/* The commitment to turn up and work is the part
                                worth surfacing — it is a date in someone's
                                calendar, not just a payment. */}
                            <p className="text-xs text-bone/50 mt-1">
                              {row.offset.mode === 'DONATE'
                                ? t('account.offsetDonated')
                                : row.offset.mode === 'IN_PERSON'
                                  ? t('account.offsetJoining')
                                  : t('account.offsetNextSession', {
                                      range: t('account.offsetSessionRange', {
                                        start: dmy(row.offset.sessionStart),
                                        end: dmy(row.offset.sessionEnd),
                                      }),
                                    })}
                            </p>
                            {row.status === 'PENDING' && (
                              <p className="text-xs text-copper mt-1">
                                {t('account.offsetPending')}
                              </p>
                            )}
                          </div>
                        )}

                        {row.kind === 'booking' && row.demoTxSigs?.length ? (
                          <div className="mt-3 border border-[#8FA37B]/40 p-2 space-y-1 text-xs text-[#8FA37B]">
                            <p>{t('travel.demoTokensSent')}</p>
                            <p className="text-[10px] text-[#F5EDDD]/45">
                              {t('account.demoSplitHint', {
                                provider: vnd(row.toProviderVnd),
                                fund: vnd(row.toCommunityFundVnd),
                              })}
                            </p>
                            {row.demoTxSigs.slice(0, 3).map((sig) => (
                              <a
                                key={sig}
                                href={`https://explorer.solana.com/tx/${sig}?cluster=devnet`}
                                target="_blank"
                                rel="noreferrer"
                                className="block underline font-mono text-[10px] break-all text-[#E8A33D]"
                              >
                                {t('travel.viewDemoTx')} · {String(sig).slice(0, 8)}…
                              </a>
                            ))}
                          </div>
                        ) : null}
                        {row.kind === 'booking' &&
                        row.paymentStatus === 'PAID' &&
                        !(row.demoTxSigs?.length) ? (
                          <p className="mt-2 text-[10px] text-[#F5EDDD]/40">
                            {t('travel.demoTokensSkipped')}
                          </p>
                        ) : null}

                        {row.kind === 'contribution' && (
                          <>
                            <p className="text-xs text-bone/45">
                              {row.entryType} · {t('account.submittedOn', { date: dmy(row.at) })}
                            </p>
                            {row.moderationNote && (
                              <p className="text-xs text-bone/55 mt-2 flex items-start gap-1.5">
                                {row.status === 'PUBLISHED' ? (
                                  <Check className="w-3 h-3 shrink-0 mt-0.5 text-sage" />
                                ) : (
                                  <X className="w-3 h-3 shrink-0 mt-0.5 text-kteh" />
                                )}
                                {t('account.committeeNote', { note: row.moderationNote })}
                              </p>
                            )}
                          </>
                        )}
                      </div>

                      {row.kind !== 'contribution' && (
                        <div className="text-right shrink-0">
                          <div className="font-display price-sm text-amber leading-none mb-1">
                            {vnd(row.totalVnd)}
                          </div>
                          <div className="text-[11px] text-bone/45 leading-relaxed max-w-[15rem]">
                            {t('account.ofWhich', { provider: vnd(row.toProviderVnd) })}
                            {row.toCommunityFundVnd > 0 &&
                              t('account.andFund', { fund: vnd(row.toCommunityFundVnd) })}
                          </div>
                          <div className="text-[11px] text-bone/35 mt-1">
                            {t('account.placedOn', { date: dmy(row.at) })}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
