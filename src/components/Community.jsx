import React, { useState } from 'react';
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

const COMMITTEE = [
  { name: 'Amí H\u2019Bia', role: 'Chair · elder', buon: 'Buôn Akô Dhông', since: '2026' },
  { name: 'Y Wik Niê', role: 'Guides and land use', buon: 'Buôn Đôn', since: '2026' },
  { name: 'Aduôn Sun', role: 'Homestays', buon: 'Buôn Trấp', since: '2026' },
  { name: 'Amí Lan', role: 'Craft and archive', buon: 'Buôn Kli A', since: '2026' },
  { name: 'Y Thăm Niê', role: 'Fund treasurer', buon: 'Buôn Trấp', since: '2026' },
  { name: 'H\u2019Ni Byă', role: 'Youth representative', buon: 'Buôn Akô Dhông', since: '2026' },
];

const QUARTERS = {
  'Q2 2026': {
    total: 24600000,
    lines: [
      { what: 'Recording equipment for the cultural archive', to: 'Buôn Kli A', amount: 7400000 },
      { what: 'Weaving apprenticeship stipends, three places', to: 'Buôn Akô Dhông', amount: 6000000 },
      { what: 'Yok Đôn buffer replanting, co-funded', to: 'Buôn Đôn', amount: 5200000 },
      { what: 'Longhouse roof repair, communal section', to: 'Buôn Trấp', amount: 4200000 },
      { what: 'Digital skills training, two sessions', to: 'All four buôn', amount: 1800000 },
    ],
  },
  'Q1 2026': {
    total: 18900000,
    lines: [
      { what: 'Gong set restoration, two sets', to: 'Buôn Đôn', amount: 8100000 },
      { what: 'Oral history recording, eleven sessions', to: 'All four buôn', amount: 5300000 },
      { what: 'Shoreline planting, wet season batch', to: 'Buôn Trấp', amount: 3500000 },
      { what: 'Committee travel and meeting costs', to: 'Committee', amount: 2000000 },
    ],
  },
};

const DECISIONS = [
  {
    status: 'declined',
    title: 'Request to film a funeral ceremony for the archive',
    from: 'External documentary producer',
    date: '14 May 2026',
    note:
      'Declined unanimously. Funeral practice is not published material. The Committee offered an interview about mourning customs instead, which the producer accepted.',
  },
  {
    status: 'passed',
    title: 'Raise the homestay floor price to 500,000 ₫ per night',
    from: 'Aduôn Sun, on behalf of hosts',
    date: '2 May 2026',
    note:
      'Passed 5 to 1. Applies to all listings from 1 June. Hosts may price above the floor; none may price below it.',
  },
  {
    status: 'open',
    title: 'Whether to onboard a fifth buôn this year',
    from: 'KNĂ platform team',
    date: '28 May 2026',
    note:
      'Under discussion. Concerns raised about onboarding capacity before existing hosts are steady. Decision deferred to the July meeting.',
  },
  {
    status: 'passed',
    title: 'Publish the phrasebook audio without restriction',
    from: 'H\u2019Ni Byă, youth representative',
    date: '19 Apr 2026',
    note:
      'Passed unanimously. Everyday language is open. Ceremonial and clan-specific speech remains unpublished.',
  },
];

const THREADS = [
  {
    author: 'Y Wik Niê',
    role: 'Guide · Buôn Đôn',
    time: '2 days ago',
    title: 'Forest walk moving to earlier starts from June',
    body:
      'The heat after ten is too much for guests and for me. Walks will start at six thirty from 1 June until the rains. Please update your listings if you run the same route.',
    replies: 7,
  },
  {
    author: 'Amí Lan',
    role: 'Weaver · Buôn Kli A',
    time: '5 days ago',
    title: 'Indigo supply is short this season',
    body:
      'The dye plot flooded in April. I have enough for maybe four more pieces. If anyone in Trấp has surplus leaf I will trade rattan for it.',
    replies: 12,
  },
  {
    author: 'Aduôn Sun',
    role: 'Host · Buôn Trấp',
    time: '1 week ago',
    title: 'Guests keep asking to help with cooking',
    body:
      'Is anyone else finding this? I do not mind but the kitchen is small. Wondering whether we should add it as a listed activity rather than let it happen by accident.',
    replies: 19,
  },
];

const vnd = (n) => n.toLocaleString('vi-VN') + ' ₫';

const STATUS = {
  passed: { icon: Check, label: 'Passed', cls: 'text-[#E8A33D] border-[#E8A33D]/40' },
  declined: { icon: X, label: 'Declined', cls: 'text-[#C8302E] border-[#C8302E]/50' },
  open: { icon: Clock, label: 'Open', cls: 'text-[#B87333] border-[#B87333]/40' },
};

export default function Community() {
  const [quarter, setQuarter] = useState('Q2 2026');
  const fund = QUARTERS[quarter];

  return (
    <div className="min-h-screen bg-[#1A1614] text-[#F5EDDD] font-body antialiased">
      <Navbar active="Community" theme="dark" />

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
            Six representatives from four buôn govern what is published, what the Community Fund
            pays for, and who may list on the platform. Minutes and allocations are public,
            including the decisions that went against the platform.
          </p>
        </div>

        <div className="md:col-span-5">
          <div className="border-l-2 border-[#B87333] pl-8 space-y-6">
            <div>
              <div className="font-display text-4xl font-medium text-[#B87333]">6</div>
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
              Members are nominated by their own buôn and serve one-year terms. KNĂ attends meetings
              to answer questions and has no vote.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {COMMITTEE.map((m) => (
              <article key={m.name} className="flex gap-5">
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
              The Fund is a pass-through, not platform revenue. The Committee decides what it pays
              for and publishes the allocation each quarter.
            </p>
          </div>

          <div className="flex gap-2">
            {Object.keys(QUARTERS).map((q) => (
              <button
                key={q}
                onClick={() => setQuarter(q)}
                className={`px-4 py-2 text-xs uppercase tracking-wider border transition ${
                  quarter === q
                    ? 'bg-[#F5EDDD] text-[#1A1614] border-[#F5EDDD]'
                    : 'border-[#F5EDDD]/25 hover:border-[#F5EDDD]/60'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="border border-[#F5EDDD]/15">
          <div className="px-8 py-6 border-b border-[#F5EDDD]/10 flex flex-wrap items-baseline justify-between gap-4">
            <span className="text-xs uppercase tracking-[0.2em] text-[#F5EDDD]/40">
              Allocated in {quarter}
            </span>
            <span className="font-display text-3xl text-[#E8A33D]">{vnd(fund.total)}</span>
          </div>

          <ul>
            {fund.lines.map((l) => (
              <li
                key={l.what}
                className="px-8 py-5 border-b border-[#F5EDDD]/10 last:border-0 flex flex-wrap items-center gap-4"
              >
                <div className="flex-1 min-w-[240px]">
                  <div className="text-sm mb-1">{l.what}</div>
                  <div className="text-xs text-[#F5EDDD]/45 flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" />
                    {l.to}
                  </div>
                </div>
                <div className="w-40 h-1.5 bg-[#F5EDDD]/10 overflow-hidden shrink-0">
                  <div
                    className="h-full bg-[#B87333]"
                    style={{ width: `${(l.amount / fund.total) * 100}%` }}
                  />
                </div>
                <span className="font-mono text-sm text-[#F5EDDD]/70 w-32 text-right shrink-0">
                  {vnd(l.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-[#F5EDDD]/40 mt-4 leading-relaxed">
          Every line above resolves to a ledger entry. Open any of them to see the transfer and the
          receipt filed by the buôn.
        </p>
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
              A governance record that only contains approvals is not a governance record. Refusals
              are published with the same detail as decisions that passed.
            </p>
          </div>

          <div className="space-y-px bg-[#1A1614]/10">
            {DECISIONS.map((d) => {
              const s = STATUS[d.status];
              return (
                <article key={d.title} className="bg-[#F5EDDD] p-6 md:p-8 flex flex-wrap gap-6">
                  <div className="w-32 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] border px-3 py-1.5 ${s.cls}`}
                    >
                      <s.icon className="w-3 h-3" />
                      {s.label}
                    </span>
                    <div className="text-xs text-[#1A1614]/45 mt-3">{d.date}</div>
                  </div>

                  <div className="flex-1 min-w-[260px]">
                    <h3 className="font-display text-xl font-medium leading-tight mb-2">
                      {d.title}
                    </h3>
                    <p className="text-xs text-[#1A1614]/50 mb-3">Raised by {d.from}</p>
                    <p className="text-sm text-[#1A1614]/70 leading-relaxed">{d.note}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── THREADS ───────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-24">
        <div className="flex flex-wrap items-end justify-between gap-8 mb-12">
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
            Readable by anyone. Posting is limited to verified providers and Committee members.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {THREADS.map((t) => (
            <article
              key={t.title}
              className="border border-[#F5EDDD]/10 hover:border-[#F5EDDD]/30 transition p-6 flex flex-col"
            >
              <div className="flex items-center gap-3 mb-5">
                <ImageSlot ratio="aspect-square" label="" className="w-9 shrink-0 p-0" />
                <div className="min-w-0">
                  <div className="text-sm truncate">{t.author}</div>
                  <div className="text-[11px] text-[#F5EDDD]/45 truncate">{t.role}</div>
                </div>
                <span className="ml-auto text-[11px] text-[#F5EDDD]/35 shrink-0">{t.time}</span>
              </div>

              <h3 className="font-display text-lg font-medium leading-tight mb-3">{t.title}</h3>
              <p className="text-sm text-[#F5EDDD]/60 leading-relaxed mb-6 flex-1">{t.body}</p>

              <div className="border-t border-[#F5EDDD]/10 pt-4 flex items-center gap-2 text-xs text-[#F5EDDD]/45">
                <MessageSquare className="w-3 h-3" />
                {t.replies} replies
              </div>
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
