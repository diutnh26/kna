import React from 'react';
import { ArrowRight, Coins, Eye, Mountain, Users } from 'lucide-react';
import Navbar from './Navbar';
import longhouseImg from '../assets/longhouse.png';
import cultureImg from '../assets/ede-culture.jpg';

const PILLARS = [
  {
    icon: Coins,
    vn: 'Trao quyền',
    title: 'Direct Economic Empowerment',
    body: 'A peer-to-peer marketplace that lets travelers book and buy directly from Ê Đê providers, so the value of an experience stays with the household that created it.',
  },
  {
    icon: Eye,
    vn: 'Bảo tồn',
    title: 'Cultural Preservation',
    body: 'An interactive digital archive of Ê Đê history, traditions, and language, developed in collaboration with community members and reviewed by elders.',
  },
  {
    icon: Mountain,
    vn: 'Gìn giữ',
    title: 'Environmental Stewardship',
    body: 'A carbon footprint tracker that channels offset contributions into conservation projects run and measured by communities in the Central Highlands.',
  },
  {
    icon: Users,
    vn: 'Cộng đồng',
    title: 'Community Engagement',
    body: 'Governance structures that give the Ê Đê community a direct voice in how the platform evolves and how revenue is distributed.',
  },
];

const CULTURE = [
  {
    mark: '①',
    title: 'Cồng Chiêng — UNESCO Intangible Heritage',
    body: 'Recognised by UNESCO in 2005, the Cồng Chiêng tradition is not merely music. It is a language that connects the living with their ancestors, performed around the fire at every gathering of significance.',
  },
  {
    mark: '②',
    title: 'The Longhouse — Architecture of Community',
    body: 'The Knă is the architectural heart of Ê Đê life. Extended families live together under one roof, governed by a matriarch. It is the gathering place, the memory keeper, and the source of this platform\u2019s name.',
  },
  {
    mark: '③',
    title: 'Weaving and Craft — Stories in Thread',
    body: 'Ê Đê textile traditions encode identity and story in every pattern. Each piece is woven by hand using techniques passed down through generations, carrying a meaning that no reproduction can replicate.',
  },
];

const LEDGER = [
  { time: '14:22', from: 'Traveler #4821', to: "H'Bia Homestay", amount: '850,000 ₫' },
  { time: '14:18', from: 'Traveler #4818', to: 'Y Wik Coffee Co-op', amount: '420,000 ₫' },
  { time: '14:11', from: 'Traveler #4815', to: 'Buôn Đôn Gong Guides', amount: '1,200,000 ₫' },
  { time: '14:05', from: 'Traveler #4812', to: 'Amí Lan Weaving', amount: '680,000 ₫' },
];

const STATS = [
  { figure: '100%', label: 'of cultural content reviewed by community elders' },
  {
    figure: '3 to 8%',
    label: 'platform commission, set to keep the value where it belongs: with the community',
  },
  { figure: '12+', label: 'Ê Đê community partners onboarded for the pilot' },
];

const FOOTER_LINKS = [
  {
    heading: 'Explore',
    items: [
      { label: 'Culture', href: '#explore' },
      { label: 'Travel', href: '#travel' },
      { label: 'Marketplace', href: '#marketplace' },
      { label: 'Community', href: '#community' },
    ],
  },
  {
    heading: 'Platform',
    items: [
      { label: 'How it works', href: '#' },
      { label: 'Transparency', href: '#' },
      { label: 'Carbon tracker', href: '#' },
      { label: 'Partners', href: '#' },
    ],
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#1A1614] text-[#F5EDDD] font-body antialiased">
      <Navbar active="" theme="dark" />

      {/* ── HERO ──────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#F5EDDD]">
        <div className="px-8 lg:px-12 xl:px-16 py-16 md:py-24 grid md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-6">
            <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-[#B87333] mb-10">
              <span className="h-px w-12 bg-[#B87333]" />
              <span>Knă · The Long House</span>
            </div>
            <h1 className="font-display text-4xl md:text-6xl font-medium leading-[1.05] tracking-tight mb-10 text-[#1A1614]">
              Travel that reaches{' '}
              <span className="italic text-[#C8302E]">the people</span> you came to meet.
            </h1>
            <p className="text-lg text-[#1A1614]/70 max-w-2xl mb-10 leading-relaxed">
              A community-owned tourism ecosystem built with the Ê Đê people of Đắk Lắk, where
              every experience is authentic, every benefit is local, and every journey leaves
              something behind worth keeping.
            </p>
            <div className="flex flex-wrap gap-4">
              <button className="group bg-[#C8302E] hover:bg-[#A82826] text-[#F5EDDD] px-8 py-4 flex items-center gap-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1A1614]">
                Begin the journey
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </button>
              <button className="border border-[#1A1614]/30 hover:border-[#1A1614]/70 text-[#1A1614] px-8 py-4 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1A1614]">
                How it works
              </button>
            </div>
          </div>

          <div className="md:col-span-6 hidden md:block relative min-h-[480px]">
            <img
              src={longhouseImg}
              alt="Illustration of a traditional Ê Đê longhouse raised on stilts"
              className="w-full h-full object-contain"
              style={{ mixBlendMode: 'multiply', opacity: 0.85 }}
            />
          </div>
        </div>
      </section>

      <div className="h-3 textile" />

      {/* ── FOUR PILLARS ──────────────────────────── */}
      <section className="bg-[#1A1614] text-[#F5EDDD]">
        <div className="px-8 lg:px-12 xl:px-16 py-24">
          <div className="mb-16 text-left">
            <div className="text-xs uppercase tracking-[0.25em] text-[#B87333] mb-6">
              What KNĂ stands on
            </div>
            <h2 className="font-display text-5xl md:text-6xl font-medium leading-[1.05] tracking-tight text-white">
              Four foundations.<span className="italic"> One long house.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-[#F5EDDD]/10">
            {PILLARS.map((p) => (
              <div
                key={p.title}
                className="bg-[#1A1614] p-8 flex flex-col min-h-[320px] items-start text-left"
              >
                <p.icon className="w-5 h-5 text-[#B87333] mb-10" />
                <div className="font-display italic text-lg text-[#B87333] mb-2">{p.vn}</div>
                <h3 className="font-display text-xl font-medium mb-4 leading-tight">{p.title}</h3>
                <p className="text-sm text-[#F5EDDD]/60 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ê ĐÊ CULTURE ──────────────────────────── */}
      <section className="bg-[#F5EDDD] text-[#1A1614]">
        <div className="grid md:grid-cols-2">
          <div className="relative overflow-hidden min-h-[400px]">
            <img
              src={cultureImg}
              alt="Ê Đê community performing a torchlit Cồng Chiêng circle beside a communal house"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#F5EDDD]/80" />
          </div>

          <div className="px-8 md:px-12 lg:px-16 py-16 md:py-20 flex flex-col justify-center">
            <div className="text-xs uppercase tracking-[0.25em] text-[#B87333] mb-6">
              The Ê Đê people
            </div>
            <h2 className="font-display text-4xl md:text-6xl font-medium leading-[1.05] tracking-tight mb-8 text-[#1A1614]">
              A living culture, <span className="italic text-[#C8302E]">still breathing.</span>
            </h2>
            <p className="text-lg leading-relaxed text-[#1A1614]/80 mb-10">
              The Ê Đê are one of the largest ethnic minority groups in the Central Highlands of
              Vietnam, with a matrilineal social structure that has governed community life for
              generations. Their culture is preserved in the rhythm of the Cồng Chiêng, the craft
              of their weavers, and the enduring architecture of the longhouse.
            </p>

            <div className="space-y-6 mb-10">
              {CULTURE.map((c, i) => (
                <div
                  key={c.title}
                  className={`flex items-start gap-5 ${
                    i < CULTURE.length - 1 ? 'border-b border-[#1A1614]/10 pb-6' : 'pb-2'
                  }`}
                >
                  <span className="text-[#B87333] font-display text-xl font-medium w-6 shrink-0 mt-0.5">
                    {c.mark}
                  </span>
                  <div>
                    <div className="font-display text-base font-medium mb-2 text-[#B87333]">
                      {c.title}
                    </div>
                    <p className="text-sm text-[#1A1614]/60 leading-relaxed">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <a
              href="#explore"
              className="group inline-flex items-center gap-2 bg-[#1A1614] text-[#F5EDDD] text-sm uppercase tracking-[0.15em] px-4 py-3 transition hover:bg-black self-start"
            >
              Explore Ê Đê culture
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </a>
          </div>
        </div>
      </section>

      {/* ── TRANSPARENCY ──────────────────────────── */}
      <section className="bg-[#8B1A1A] text-[#F5EDDD] relative overflow-hidden">
        <div className="px-8 lg:px-12 xl:px-16 py-24 grid md:grid-cols-12 gap-12 relative z-10">
          <div className="md:col-span-6">
            <div className="text-xs uppercase tracking-[0.25em] text-[#F5EDDD]/70 mb-6">
              Financial transparency
            </div>
            <h2 className="font-display text-5xl md:text-6xl font-medium leading-[1.05] tracking-tight mb-8">
              Tracked, not promised.
            </h2>
            <p className="text-lg leading-relaxed text-[#F5EDDD]/90 mb-8">
              Every transaction on KNĂ is recorded on a public ledger. Travelers see where their
              money goes. Communities see what they earned. Partners verify what they claim.
            </p>
            <p className="font-display italic text-2xl leading-snug">
              &ldquo;Transparency stops being a slogan when anyone can check.&rdquo;
            </p>
          </div>

          <div className="md:col-span-6 flex items-center">
            <div className="w-full bg-[#1A1614] p-8 font-mono text-sm">
              <div className="text-[#F5EDDD]/40 text-xs uppercase tracking-wider mb-6">
                Public ledger · live sample
              </div>
              <div className="space-y-4">
                {LEDGER.map((tx) => (
                  <div
                    key={tx.time}
                    className="flex items-center justify-between gap-4 text-xs border-b border-[#F5EDDD]/10 pb-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[#B87333] shrink-0">{tx.time}</span>
                      <span className="text-[#F5EDDD]/50 shrink-0">{tx.from}</span>
                      <span className="text-[#F5EDDD]/30 shrink-0">→</span>
                      <span className="truncate">{tx.to}</span>
                    </div>
                    <span className="text-[#E8A33D] shrink-0">{tx.amount}</span>
                  </div>
                ))}
              </div>
              <div className="text-[#F5EDDD]/40 text-xs pt-4">
                + 1,247 more transactions today
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMMUNITY ─────────────────────────────── */}
      <section className="bg-[#F5EDDD] text-[#1A1614]">
        <div className="px-8 lg:px-12 xl:px-16 py-24">
          <div className="grid md:grid-cols-12 gap-12 items-center">
            <div className="md:col-span-7">
              <div className="text-xs uppercase tracking-[0.25em] text-[#B87333] mb-6">
                By the community
              </div>
              <h2 className="font-display text-5xl md:text-6xl font-medium leading-[1.05] tracking-tight mb-8 text-[#6B1A1A]">
                Not about the Ê Đê.
                <br />
                <span className="italic">By</span> the Ê Đê.
              </h2>
              <p className="text-lg leading-relaxed text-[#1A1614]/70">
                Cultural content is reviewed by community elders. Service providers are verified by
                community representatives. Revenue distribution decisions sit with a council of Ê Đê
                stakeholders, not a corporate board. KNĂ exists in service of the longhouse it is
                named after.
              </p>
            </div>

            <div className="md:col-span-5">
              <div className="border-l-4 border-[#C8302E] pl-8 py-4 space-y-8">
                {STATS.map((s) => (
                  <div key={s.figure}>
                    <div className="font-display text-5xl font-medium text-[#C8302E] mb-1">
                      {s.figure}
                    </div>
                    <p className="text-sm text-[#1A1614]/70">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="h-3 textile" />

      {/* ── INVITATION ────────────────────────────── */}
      <section className="bg-[#1A1614] text-[#F5EDDD]">
        <div className="px-8 lg:px-12 xl:px-16 py-32 text-center">
          <div className="text-xs uppercase tracking-[0.25em] text-[#B87333] mb-8">
            The invitation
          </div>
          <h2 className="font-display text-5xl md:text-8xl font-medium leading-[0.95] tracking-tight mb-10 max-w-4xl mx-auto text-white">
            Where will you
            <br />
            <span className="italic text-[#E8A33D]">stay tonight?</span>
          </h2>
          <p className="text-lg text-[#F5EDDD]/70 max-w-3xl mb-12 mx-auto">
            The longhouse is wide. There is room for travelers who arrive in good faith.
          </p>
          <button className="group bg-[#C8302E] hover:bg-[#A82826] text-[#F5EDDD] px-10 py-5 inline-flex items-center gap-3 transition text-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1614] focus-visible:ring-[#F5EDDD]">
            Begin the journey
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
          </button>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────── */}
      <footer className="border-t border-[#F5EDDD]/10 bg-[#1A1614] text-[#F5EDDD]/60">
        <div className="px-8 lg:px-12 xl:px-16 py-16 grid grid-cols-2 md:grid-cols-[1.8fr_0.6fr_0.6fr_1.5fr] gap-12 text-left items-start">
          <div>
            <div className="font-display text-2xl text-[#F5EDDD] mb-3">KNĂ</div>
            <p className="text-sm leading-relaxed">
              A responsible tourism platform for the Ê Đê people of Đắk Lắk. Built for the BKI 2026
              competition by students of Ho Chi Minh City University of Economics and Finance.
            </p>
          </div>

          {FOOTER_LINKS.map((col) => (
            <div key={col.heading}>
              <div className="text-xs uppercase tracking-[0.2em] text-[#F5EDDD] mb-4">
                {col.heading}
              </div>
              <ul className="space-y-2 text-sm">
                {col.items.map((item) => (
                  <li key={item.label}>
                    <a href={item.href} className="hover:text-[#F5EDDD] transition">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#F5EDDD] mb-4">
              Stay in touch
            </div>
            <p className="text-sm mb-4">Updates from the longhouse, sent occasionally.</p>
            <div className="flex">
              <label htmlFor="newsletter" className="sr-only">
                Email address
              </label>
              <input
                id="newsletter"
                type="email"
                placeholder="your@email.com"
                className="bg-[#F5EDDD]/5 border border-[#F5EDDD]/20 px-4 py-3 text-sm flex-1 min-w-0 focus:outline-none focus:border-[#F5EDDD]/60"
              />
              <button
                className="bg-[#C8302E] px-5 text-[#F5EDDD] text-sm hover:bg-[#A82826] transition"
                aria-label="Subscribe"
              >
                →
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-[#F5EDDD]/10">
          <div className="px-8 lg:px-12 xl:px-16 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-[#F5EDDD]/40">
            <div>© 2026 KNĂ · Bach Khoa Innovation 2026</div>
            <div className="flex gap-6">
              <a href="#" className="hover:text-[#F5EDDD]/70 transition">Privacy</a>
              <a href="#" className="hover:text-[#F5EDDD]/70 transition">Terms</a>
              <a href="#" className="hover:text-[#F5EDDD]/70 transition">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
