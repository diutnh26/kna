import { useEffect, useState } from 'react';
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

// Illustrative only — the provider board is not built. See the note
// rendered above these cards; they are examples of what hosts would use
// it for, not posts anyone has made.
const EXAMPLE_THREADS = [
  {
    author: 'A guide',
    role: 'Buôn Đôn',
    title: 'Forest walk moving to earlier starts from June',
    body:
      'The heat after ten is too much for guests and for me. Walks will start at six thirty from 1 June until the rains. Please update your listings if you run the same route.',
  },
  {
    author: 'A weaver',
    role: 'Buôn Kli A',
    title: 'Indigo supply is short this season',
    body:
      'The dye plot flooded in April. I have enough for maybe four more pieces. If anyone in Trấp has surplus leaf I will trade rattan for it.',
  },
  {
    author: 'A host',
    role: 'Buôn Trấp',
    title: 'Guests keep asking to help with cooking',
    body:
      'Is anyone else finding this? I do not mind but the kitchen is small. Wondering whether we should add it as a listed activity rather than let it happen by accident.',
  },
];

const vnd = (n) => n.toLocaleString('vi-VN') + ' ₫';

const dmy = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const STATUS = {
  passed: { icon: Check, label: 'Passed', cls: 'text-[#E8A33D] border-[#E8A33D]/40' },
  declined: { icon: X, label: 'Declined', cls: 'text-[#C8302E] border-[#C8302E]/50' },
  open: { icon: Clock, label: 'Open', cls: 'text-[#B87333] border-[#B87333]/40' },
};

export default function Community() {
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
            <span>Community space</span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-medium leading-[1.05] tracking-tight mb-8">
            The decisions are made here, in the open.
          </h1>
          <p className="text-lg text-[#F5EDDD]/70 max-w-2xl leading-relaxed">
            Representatives from the onboarded buôn govern what is published, what the Community
            Fund pays for, and who may list on the platform. Minutes and allocations are public,
            including the decisions that went against the platform.
          </p>
        </div>

        <div className="md:col-span-5">
          <div className="border-l-2 border-[#B87333] pl-8 space-y-6">
            <div>
              <div className="font-display text-4xl font-medium text-[#B87333]">
                {stats ? stats.committeeMembers : '—'}
              </div>
              <p className="text-sm text-[#F5EDDD]/60">committee members, all Ê Đê</p>
            </div>
            <div>
              <div className="font-display text-4xl font-medium text-[#B87333]">Monthly</div>
              <p className="text-sm text-[#F5EDDD]/60">meetings, minutes published within a week</p>
            </div>
            <div>
              <div className="font-display text-4xl font-medium text-[#B87333]">0</div>
              <p className="text-sm text-[#F5EDDD]/60">KNĂ staff with a vote</p>
            </div>
          </div>
        </div>
      </section>

      {loadState === 'error' && (
        <section className="px-8 lg:px-12 xl:px-16 pb-24">
          <div className="border border-dashed border-[#F5EDDD]/20 py-20 text-center">
            <p className="font-display text-2xl mb-3">Couldn&rsquo;t reach the KNĂ API.</p>
            <p className="text-sm text-[#F5EDDD]/60">
              Is <code className="text-[#E8A33D]">apps/api</code> running on{' '}
              <code className="text-[#E8A33D]">localhost:4000</code>?
            </p>
          </div>
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
                    Community Governance Committee
                  </div>
                  <h2 className="font-display text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight text-[#6B1A1A]">
                    Named people, not a board of advisors.
                  </h2>
                </div>
                <p className="text-sm text-[#1A1614]/60 max-w-sm leading-relaxed">
                  Members are nominated by their own buôn and serve one-year terms. KNĂ attends
                  meetings to answer questions and has no vote.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {committee.map((m) => (
                  <article key={m.id} className="flex gap-5">
                    <ImageSlot
                      theme="light"
                      ratio="aspect-square"
                      label="Portrait"
                      className="w-24 shrink-0"
                    />
                    <div className="pt-1">
                      <h3 className="font-display text-xl font-medium leading-tight mb-1">{m.name}</h3>
                      <p className="text-sm text-[#B87333] mb-2">{m.role}</p>
                      <p className="text-xs text-[#1A1614]/55 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" />
                        {m.buon}
                      </p>
                      <p className="text-xs text-[#1A1614]/40 mt-1">Serving since {m.since}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* ── FUND ──────────────────────────────────── */}
          <section className="px-8 lg:px-12 xl:px-16 py-24">
            <div className="flex flex-wrap items-end justify-between gap-8 mb-12">
              <div className="max-w-xl">
                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-[#B87333] mb-6">
                  <Wallet className="w-4 h-4" />
                  Community Fund
                </div>
                <h2 className="font-display text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight mb-6">
                  Three percent of every booking, spent line by line.
                </h2>
                <p className="text-lg text-[#F5EDDD]/70 leading-relaxed">
                  The Fund is a pass-through, not platform revenue. The Committee decides what it
                  pays for and publishes the allocation each quarter.
                </p>
              </div>

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
                    Allocated in {fund.quarter}
                  </span>
                  <span className="font-display text-3xl text-[#E8A33D]">{vnd(fund.totalVnd)}</span>
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
                      <span className="font-mono text-sm text-[#F5EDDD]/70 w-32 text-right shrink-0">
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
              <div className="max-w-2xl mb-14">
                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-[#C8302E] mb-6">
                  <FileText className="w-4 h-4" />
                  Minutes
                </div>
                <h2 className="font-display text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight text-[#6B1A1A] mb-6">
                  Including the ones that said no.
                </h2>
                <p className="text-lg text-[#1A1614]/70 leading-relaxed">
                  A governance record that only contains approvals is not a governance record.
                  Refusals are published with the same detail as decisions that passed.
                </p>
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

      {/* ── PROVIDER BOARD (not built) ────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-24">
        <div className="flex flex-wrap items-end justify-between gap-8 mb-6">
          <div className="max-w-xl">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-[#B87333] mb-6">
              <MessageSquare className="w-4 h-4" />
              Provider board
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight">
              Hosts talking to hosts.
            </h2>
          </div>
          <p className="text-sm text-[#F5EDDD]/50 max-w-sm leading-relaxed">
            Planned to be readable by anyone, with posting limited to verified providers and
            Committee members.
          </p>
        </div>

        <div className="border border-[#B87333]/40 bg-[#B87333]/5 px-6 py-4 mb-10">
          <p className="text-sm text-[#F5EDDD]/70 leading-relaxed">
            <span className="text-[#B87333] uppercase tracking-wider text-xs">Not yet built · </span>
            The board is on the roadmap and nobody has posted to it. The cards below are examples of
            what hosts told us they would use it for.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 opacity-60">
          {EXAMPLE_THREADS.map((t) => (
            <article key={t.title} className="border border-dashed border-[#F5EDDD]/15 p-6 flex flex-col">
              <div className="flex items-center gap-3 mb-5">
                <ImageSlot ratio="aspect-square" label="" className="w-9 shrink-0 p-0" />
                <div className="min-w-0">
                  <div className="text-sm truncate">{t.author}</div>
                  <div className="text-[11px] text-[#F5EDDD]/45 truncate">{t.role}</div>
                </div>
              </div>

              <h3 className="font-display text-lg font-medium leading-tight mb-3">{t.title}</h3>
              <p className="text-sm text-[#F5EDDD]/60 leading-relaxed flex-1">{t.body}</p>
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
              After your stay
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-medium leading-[1.1] tracking-tight text-[#6B1A1A] mb-6">
              Your feedback goes to the Committee, not to a ratings algorithm.
            </h2>
            <p className="text-lg text-[#1A1614]/70 leading-relaxed">
              There are no star ratings on KNĂ. Comments are read at the monthly meeting and, where
              they concern a host, shared with that household first.
            </p>
          </div>

          <div className="md:col-span-6 grid sm:grid-cols-2 gap-8">
            {[
              {
                h: 'Why no stars',
                b: 'A four out of five on a family home is a judgement on a household, published permanently. Written comments carry the same information without that cost.',
              },
              {
                h: 'What happens to a complaint',
                b: 'It goes to the host and to the Committee together. Serious or repeated issues can suspend a listing, and that decision appears in the minutes.',
              },
            ].map((n) => (
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
            That is the whole of it.
          </h2>
          <p className="text-[#F5EDDD]/70">
            The archive, the experiences, the marketplace, the ledger, and the people who decide.
          </p>
        </div>
        <a
          href="#home"
          className="group inline-flex items-center gap-3 bg-[#C8302E] hover:bg-[#A82826] px-8 py-4 transition"
        >
          Back to the beginning
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
        </a>
      </section>
    </div>
  );
}
