import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Gavel,
  Wallet,
  MessageSquare,
  Check,
  X,
  Clock,
  MapPin,
  FileText,
  Megaphone,
} from 'lucide-react';
import Navbar from './Navbar';
import ImageSlot from './ImageSlot';
import { api } from '../lib/api';
import ApiErrorNotice from './ApiErrorNotice';
import InitialAvatar from './InitialAvatar';

// Illustrative only — the provider board is not built. See the note
const vnd = (n) => n.toLocaleString('vi-VN') + ' ₫';

const dmy = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// The structural half of the SDG section: which icon, and which screen
// substantiates the claim. The prose half is in the locale files, indexed
// to match. Split this way because neither the icon nor the destination is
// a translation, and a Vietnamese reader should not be able to drift them.
//
// Every href leaves this page. Hash routing means the hash *is* the route,
// so an in-page anchor would navigate away instead of scrolling; the public
// ledger link therefore goes to Landing, which carries a live sample of it.
const SDG_GOALS = [
  { icon: '/images/sdg/sdg-09.png', href: '#explore' },
  { icon: '/images/sdg/sdg-10.png', href: '#travel', core: true },
  { icon: '/images/sdg/sdg-12.png', href: '#home' },
  { icon: '/images/sdg/sdg-13.png', href: '#carbon' },
];


export default function Community() {
  const { t } = useTranslation();
  // Built from t() rather than a module constant, so these follow the
  // language toggle instead of freezing at import time.
  const STATUS = {
    passed: { icon: Check, label: t('community.statusPassed'), cls: 'text-[#E8A33D] border-[#E8A33D]/40' },
    declined: { icon: X, label: t('community.statusDeclined'), cls: 'text-[#C8302E] border-[#C8302E]/50' },
    open: { icon: Clock, label: t('community.statusOpen'), cls: 'text-[#B87333] border-[#B87333]/40' },
  };
  const exampleThreads = t('community.threads', { returnObjects: true });
  const feedbackNotes = t('community.feedbackNotes', { returnObjects: true });
  const sdgGoals = t('community.sdg.goals', { returnObjects: true });
  const [committee, setCommittee] = useState([]);
  const [quarters, setQuarters] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [stats, setStats] = useState(null);
  const [quarterIndex, setQuarterIndex] = useState(0);
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.committee(), api.fund(), api.decisions(), api.communityStats()])
      .then(([committeeData, fundData, decisionData, statsData]) => {
        if (cancelled) return;
        setCommittee(committeeData);
        setQuarters(fundData);
        setDecisions(decisionData);
        setStats(statsData);
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fund = quarters[quarterIndex] ?? null;

  return (
    <div className="min-h-screen bg-[#1A1614] text-[#F5EDDD] font-body antialiased">
      <Navbar active="community" theme="dark" />

      {/* ── OPENING ───────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-20 md:py-24 grid md:grid-cols-12 gap-12 items-end">
        <div className="md:col-span-7">
          <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-[#B87333] mb-8">
            <span className="h-px w-12 bg-[#B87333]" />
            <span>{t('community.eyebrow')}</span>
          </div>
          <h1 className="font-display page-title-sm font-medium leading-[1.05] tracking-tight mb-8">
            {t('community.title')}
          </h1>
          <p className="text-lg text-[#F5EDDD]/70 max-w-2xl leading-relaxed">
            {t('community.intro')}
          </p>
        </div>

        <div className="md:col-span-5">
          <div className="border-l-2 border-[#B87333] pl-8 space-y-6">
            <div>
              <div className="font-display text-4xl font-medium text-[#B87333]">
                {stats ? stats.committeeMembers : '—'}
              </div>
              <p className="text-sm text-[#F5EDDD]/60">{t('community.statMembers')}</p>
            </div>
            <div>
              <div className="font-display text-4xl font-medium text-[#B87333]">{t('community.statMonthly')}</div>
              <p className="text-sm text-[#F5EDDD]/60">{t('community.statMeetings')}</p>
            </div>
            <div>
              <div className="font-display text-4xl font-medium text-[#B87333]">0</div>
              <p className="text-sm text-[#F5EDDD]/60">{t('community.statNoVote')}</p>
            </div>
          </div>
        </div>
      </section>

      {loadState === 'error' && (
        <section className="px-8 lg:px-12 xl:px-16 pb-24">
          <ApiErrorNotice />
        </section>
      )}

      {loadState === 'ready' && (
        <>
          {/* ── COMMITTEE ─────────────────────────────── */}
          <section className="bg-[#F5EDDD] text-[#1A1614]">
            <div className="px-8 lg:px-12 xl:px-16 py-24">
              <div className="flex flex-wrap items-end justify-between gap-8 mb-14">
                <div className="max-w-xl">
                  <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-[#C8302E] mb-6">
                    <Gavel className="w-4 h-4" />
                    {t('community.committeeEyebrow')}
                  </div>
                  <h2 className="font-display section-title font-medium leading-[1.1] tracking-tight text-[#6B1A1A]">
                    {t('community.committeeHeading')}
                  </h2>
                </div>
                <p className="text-sm text-[#1A1614]/60 max-w-sm leading-relaxed">
                  {t('community.committeeBody')}
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {committee.map((m) => (
                  <article key={m.id} className="flex gap-5">
                    {/* A real photograph the moment one exists and its
                        subject has agreed; a woven monogram until then.
                        Not a generated face: these are named people, and a
                        synthetic portrait of an Ê Đê elder is
                        indistinguishable from a real one once screenshotted
                        away from the demonstration banner. */}
                    {m.imageUrl ? (
                      <ImageSlot
                        src={m.imageUrl}
                        theme="light"
                        ratio="aspect-square"
                        label={t('community.portrait')}
                        alt={t('community.portraitOf', { name: m.name })}
                        className="w-24 shrink-0"
                      />
                    ) : (
                      <InitialAvatar name={m.name} className="w-24 shrink-0" />
                    )}
                    <div className="pt-1">
                      <h3 className="font-display text-xl font-medium leading-tight mb-1">{m.name}</h3>
                      <p className="text-sm text-[#B87333] mb-2">{m.role}</p>
                      <p className="text-xs text-[#1A1614]/55 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" />
                        {m.buon}
                      </p>
                      <p className="text-xs text-[#1A1614]/40 mt-1">{t('community.servingSince', { date: m.since })}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* ── FUND ──────────────────────────────────── */}
          <section className="px-8 lg:px-12 xl:px-16 py-24">
            {/* Title left, prose right. It was a max-w-xl column beside a
                short row of quarter buttons, so the heading wrapped into
                several lines while most of the row sat empty. */}
            <div className="grid md:grid-cols-12 gap-8 md:gap-12 items-start mb-10">
              <div className="md:col-span-5">
                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-[#B87333] mb-6">
                  <Wallet className="w-4 h-4" />
                  {t('community.fundEyebrow')}
                </div>
                <h2 className="font-display section-title font-medium leading-[1.1] tracking-tight">
                  {t('community.fundHeading')}
                </h2>
              </div>
              <div className="md:col-span-7 md:pt-10">
                <p className="text-lg text-[#F5EDDD]/70 leading-relaxed">
                  {t('community.fundBody')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-8 mb-12">
              <div className="flex gap-2">
                {quarters.map((q, i) => (
                  <button
                    key={q.quarter}
                    onClick={() => setQuarterIndex(i)}
                    className={`px-4 py-2 text-xs uppercase tracking-wider border transition ${
                      quarterIndex === i
                        ? 'bg-[#F5EDDD] text-[#1A1614] border-[#F5EDDD]'
                        : 'border-[#F5EDDD]/25 hover:border-[#F5EDDD]/60'
                    }`}
                  >
                    {q.quarter}
                  </button>
                ))}
              </div>
            </div>

            {fund && (
              <div className="border border-[#F5EDDD]/15">
                <div className="px-8 py-6 border-b border-[#F5EDDD]/10 flex flex-wrap items-baseline justify-between gap-4">
                  <span className="text-xs uppercase tracking-[0.2em] text-[#F5EDDD]/40">
                    {t('community.fundAllocated', { quarter: fund.quarter })}
                  </span>
                  <span className="font-display price-md text-[#E8A33D]">{vnd(fund.totalVnd)}</span>
                </div>

                <ul>
                  {fund.lines.map((l) => (
                    <li
                      key={l.id}
                      className="px-8 py-5 border-b border-[#F5EDDD]/10 last:border-0 flex flex-wrap items-center gap-4"
                    >
                      <div className="flex-1 min-w-[240px]">
                        <div className="text-sm mb-1">{l.what}</div>
                        <div className="text-xs text-[#F5EDDD]/45 flex items-center gap-1.5">
                          <MapPin className="w-3 h-3" />
                          {l.toBuon}
                        </div>
                      </div>
                      <div className="w-40 h-1.5 bg-[#F5EDDD]/10 overflow-hidden shrink-0">
                        <div
                          className="h-full bg-[#B87333]"
                          style={{ width: `${(l.amountVnd / fund.totalVnd) * 100}%` }}
                        />
                      </div>
                      <span className="font-mono price-xs text-[#F5EDDD]/70 w-32 text-right shrink-0">
                        {vnd(l.amountVnd)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* ── DECISIONS ─────────────────────────────── */}
          <section className="bg-[#F5EDDD] text-[#1A1614]">
            <div className="px-8 lg:px-12 xl:px-16 py-24">
              <div className="grid md:grid-cols-12 gap-8 md:gap-12 items-start mb-14">
                <div className="md:col-span-5">
                  <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-[#C8302E] mb-6">
                    <FileText className="w-4 h-4" />
                    {t('community.minutesEyebrow')}
                  </div>
                  <h2 className="font-display section-title font-medium leading-[1.1] tracking-tight text-[#6B1A1A]">
                    {t('community.minutesHeading')}
                  </h2>
                </div>
                <div className="md:col-span-7 md:pt-10">
                  <p className="text-lg text-[#1A1614]/70 leading-relaxed">
                    {t('community.minutesBody')}
                  </p>
                </div>
              </div>

              <div className="space-y-px bg-[#1A1614]/10">
                {decisions.map((d) => {
                  const s = STATUS[d.status] ?? STATUS.open;
                  return (
                    <article key={d.id} className="bg-[#F5EDDD] p-6 md:p-8 flex flex-wrap gap-6">
                      <div className="w-32 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] border px-3 py-1.5 ${s.cls}`}
                        >
                          <s.icon className="w-3 h-3" />
                          {s.label}
                        </span>
                        <div className="text-xs text-[#1A1614]/45 mt-3">{dmy(d.date)}</div>
                      </div>

                      <div className="flex-1 min-w-[260px]">
                        <h3 className="font-display text-xl font-medium leading-tight mb-2">
                          {d.title}
                        </h3>
                        <p className="text-xs text-[#1A1614]/50 mb-3">Raised by {d.fromLabel}</p>
                        <p className="text-sm text-[#1A1614]/70 leading-relaxed">{d.note}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        </>
      )}

      {/* ── SDG ALIGNMENT ─────────────────────────── */}
      {/* After the Committee, the Fund and the decisions rather than before
          them: the goals are a claim, and the three sections above are what
          makes the claim checkable. Outside the data-gated fragment, because
          nothing here depends on the API being reachable. */}
      <section className="border-t border-[#F5EDDD]/10">
        <div className="px-8 lg:px-12 xl:px-16 py-24">
          <div className="flex flex-wrap items-start justify-between gap-10 mb-16">
            <div className="max-w-2xl">
              <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-[#B87333] mb-6">
                <span className="h-px w-12 bg-[#B87333]" />
                <span>{t('community.sdg.eyebrow')}</span>
              </div>
              <h2 className="font-display text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight mb-6">
                {t('community.sdg.heading')}
              </h2>
              <p className="text-[#F5EDDD]/70 leading-relaxed">{t('community.sdg.body')}</p>
            </div>
            <img
              src="/images/sdg/sdg-wheel.png"
              alt={t('community.sdg.wheelAlt')}
              width="256"
              height="256"
              className="w-20 h-20 rounded shrink-0"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-x-12 gap-y-12">
            {sdgGoals.map((goal, i) => (
              <article key={goal.number} className="flex gap-6">
                {/* Reproduced at their published proportions and colours.
                    The goal name is repeated as text beside each one because
                    the official icons carry it in English only. */}
                <img
                  src={SDG_GOALS[i].icon}
                  alt={goal.alt}
                  width="256"
                  height="256"
                  loading="lazy"
                  className="w-20 h-20 md:w-24 md:h-24 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-[#B87333]">
                      {goal.number}
                    </span>
                    {SDG_GOALS[i].core && (
                      <span className="text-[10px] uppercase tracking-[0.18em] text-[#E8A33D] border border-[#E8A33D]/40 rounded-full px-2 py-0.5">
                        {t('community.sdg.coreLabel')}
                      </span>
                    )}
                  </div>
                  <h3 className="font-display text-xl font-medium leading-tight mb-3">
                    {goal.name}
                  </h3>
                  <p className="text-sm text-[#F5EDDD]/70 leading-relaxed mb-4">
                    {goal.mechanism}
                  </p>
                  <a
                    href={SDG_GOALS[i].href}
                    className="inline-flex items-center gap-2 text-sm text-[#B87333] hover:text-[#E8A33D] transition-colors"
                  >
                    {goal.linkLabel}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </article>
            ))}
          </div>

          <p className="text-xs text-[#F5EDDD]/35 mt-14">{t('community.sdg.note')}</p>
        </div>
      </section>

      {/* ── PROVIDER BOARD (not built) ────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-24">
        <div className="flex flex-wrap items-end justify-between gap-8 mb-6">
          <div className="max-w-xl">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-[#B87333] mb-6">
              <MessageSquare className="w-4 h-4" />
              {t('community.boardEyebrow')}
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight">
              {t('community.boardHeading')}
            </h2>
          </div>
          <p className="text-sm text-[#F5EDDD]/50 max-w-sm leading-relaxed">
            {t('community.boardBody')}
          </p>
        </div>

        <div className="border border-[#B87333]/40 bg-[#B87333]/5 px-6 py-4 mb-10">
          <p className="text-sm text-[#F5EDDD]/70 leading-relaxed">
            <span className="text-[#B87333] uppercase tracking-wider text-xs">{t('community.boardNotBuiltLabel')}</span>
            {t('community.boardNotBuiltBody')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 opacity-60">
          {exampleThreads.map((thread) => (
            <article key={thread.title} className="border border-dashed border-[#F5EDDD]/15 p-6 flex flex-col">
              <div className="flex items-center gap-3 mb-5">
                {/* A monogram, not a face. These posts are illustrative —
                    there is no real person to photograph, and a generated
                    portrait would imply one. */}
                <InitialAvatar name={thread.author} className="w-9 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm truncate">{thread.author}</div>
                  <div className="text-[11px] text-[#F5EDDD]/45 truncate">{thread.role}</div>
                </div>
              </div>

              <h3 className="font-display text-lg font-medium leading-tight mb-3">{thread.title}</h3>
              <p className="text-sm text-[#F5EDDD]/60 leading-relaxed flex-1">{thread.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── FEEDBACK ──────────────────────────────── */}
      <section className="bg-[#F5EDDD] text-[#1A1614]">
        <div className="px-8 lg:px-12 xl:px-16 py-20 grid md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-6">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-[#C8302E] mb-6">
              <Megaphone className="w-4 h-4" />
              {t('community.feedbackEyebrow')}
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-medium leading-[1.1] tracking-tight text-[#6B1A1A] mb-6">
              {t('community.feedbackHeading')}
            </h2>
            <p className="text-lg text-[#1A1614]/70 leading-relaxed">
              {t('community.feedbackBody')}
            </p>
          </div>

          <div className="md:col-span-6 grid sm:grid-cols-2 gap-8">
            {feedbackNotes.map((n) => (
              <div key={n.h}>
                <h3 className="font-display text-lg font-medium mb-2 text-[#B87333]">{n.h}</h3>
                <p className="text-sm text-[#1A1614]/65 leading-relaxed">{n.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-3 textile" />

      {/* ── HANDOFF ───────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-20 flex flex-wrap items-center justify-between gap-8">
        <div className="max-w-xl">
          <h2 className="font-display text-3xl md:text-4xl font-medium leading-tight mb-3">
            {t('community.closingHeading')}
          </h2>
          <p className="text-[#F5EDDD]/70">
            {t('community.closingBody')}
          </p>
        </div>
        <a
          href="#home"
          className="group inline-flex items-center gap-3 bg-[#C8302E] hover:bg-[#A82826] px-8 py-4 transition"
        >
          {t('community.closingCta')}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
        </a>
      </section>
    </div>
  );
}
