import React, { useState } from 'react';
import {
  ArrowRight,
  ShieldCheck,
  ScanLine,
  MapPin,
  Clock,
  Search,
  ShoppingBag,
  Info,
} from 'lucide-react';
import Navbar from './Navbar';
import ImageSlot from './ImageSlot';

const CATEGORIES = ['All', 'Textile', 'Woodwork', 'Basketry', 'Jewellery', 'Coffee'];

const PRODUCTS = [
  {
    id: 'KNA-TX-0114',
    category: 'Textile',
    title: 'Ceremonial skirt panel, indigo and madder',
    maker: 'Amí Lan',
    buon: 'Buôn Kli A',
    madeIn: '11 weeks',
    price: 4200000,
    stock: 1,
    note:
      'Woven on a backstrap loom in the pattern of her mother\u2019s clan. The border motif marks it as a piece for ceremony rather than daily wear.',
  },
  {
    id: 'KNA-BK-0207',
    category: 'Basketry',
    title: 'Gùi carrying basket, rattan and bamboo',
    maker: 'Y Blă Êban',
    buon: 'Buôn Đôn',
    madeIn: '9 days',
    price: 950000,
    stock: 6,
    note:
      'The everyday shape, still made the everyday way. Rattan cut at the end of the dry season, when the fibre holds its tension longest.',
  },
  {
    id: 'KNA-WD-0038',
    category: 'Woodwork',
    title: 'Carved stool, single block of jackfruit',
    maker: 'Y Thăm Niê',
    buon: 'Buôn Trấp',
    madeIn: '3 weeks',
    price: 2800000,
    stock: 2,
    note:
      'Cut from a jackfruit tree that came down in a storm. Y Thăm works only fallen wood and will tell you which tree each piece came from.',
  },
  {
    id: 'KNA-TX-0121',
    category: 'Textile',
    title: 'Shoulder cloth, narrow loom',
    maker: 'H\u2019Ni Byă',
    buon: 'Buôn Akô Dhông',
    madeIn: '4 weeks',
    price: 1650000,
    stock: 4,
    note:
      'H\u2019Ni is twenty-three and one of six weavers under thirty still working in the buôn. Buying her work is the argument for the seventh.',
  },
  {
    id: 'KNA-JW-0092',
    category: 'Jewellery',
    title: 'Brass wrist ring, hand-forged pair',
    maker: 'Y Sun Adrơng',
    buon: 'Buôn Đôn',
    madeIn: '5 days',
    price: 780000,
    stock: 9,
    note:
      'Worn in pairs, traditionally given at a wedding. Y Sun forges them over charcoal in the same yard his father used.',
  },
  {
    id: 'KNA-CF-0450',
    category: 'Coffee',
    title: 'Robusta, wood-fired roast, 500g',
    maker: 'Y Wik Coffee Co-op',
    buon: 'Buôn Đôn',
    madeIn: 'Roasted to order',
    price: 320000,
    stock: 40,
    note:
      'Grown, picked, and roasted by the twelve households of the co-op. Dark, low acid, and roasted over wood rather than gas.',
  },
];

const vnd = (n) => n.toLocaleString('vi-VN') + ' ₫';

export default function Marketplace() {
  const [category, setCategory] = useState('All');
  const shown =
    category === 'All' ? PRODUCTS : PRODUCTS.filter((p) => p.category === category);

  return (
    <div className="min-h-screen bg-[#1A1614] text-[#F5EDDD] font-body antialiased">
      <Navbar active="Marketplace" theme="dark" />

      {/* ── OPENING ───────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-20 md:py-24 grid md:grid-cols-12 gap-12 items-end">
        <div className="md:col-span-7">
          <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-[#B87333] mb-8">
            <span className="h-px w-12 bg-[#B87333]" />
            <span>Community Marketplace</span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-medium leading-[1.05] tracking-tight mb-8">
            Made by a person you can name.
          </h1>
          <p className="text-lg text-[#F5EDDD]/70 max-w-2xl leading-relaxed">
            Every item here carries a certificate tying it to the maker, the buôn, and the weeks it
            took. Artisans set their prices and keep 95% of what you pay.
          </p>
        </div>

        <div className="md:col-span-5">
          <div className="border-l-2 border-[#B87333] pl-8 space-y-6">
            <div>
              <div className="font-display text-4xl font-medium text-[#B87333]">95%</div>
              <p className="text-sm text-[#F5EDDD]/60">stays with the artisan</p>
            </div>
            <div>
              <div className="font-display text-4xl font-medium text-[#B87333]">30</div>
              <p className="text-sm text-[#F5EDDD]/60">makers listing in the pilot</p>
            </div>
            <div>
              <div className="font-display text-4xl font-medium text-[#B87333]">4</div>
              <p className="text-sm text-[#F5EDDD]/60">buôn represented</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CERTIFICATE EXPLAINER ─────────────────── */}
      <section className="bg-[#F5EDDD] text-[#1A1614]">
        <div className="px-8 lg:px-12 xl:px-16 py-20 grid md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-6">
            <div className="text-xs uppercase tracking-[0.25em] text-[#C8302E] mb-6">
              The certificate
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight text-[#6B1A1A] mb-8">
              Authenticity you can check, not a label you have to trust.
            </h2>
            <p className="text-lg text-[#1A1614]/70 leading-relaxed mb-6">
              Each piece is registered when the maker finishes it. The record holds who made it,
              where, how long it took, and what it is for. Scan the tag and the same record opens,
              alongside the payment that reached the household.
            </p>
            <p className="text-sm text-[#1A1614]/55 leading-relaxed">
              Certificates are issued by the Community Governance Committee, not by KNĂ. Only work
              made by a registered Ê Đê household can carry one.
            </p>
          </div>

          {/* Sample certificate */}
          <div className="md:col-span-6">
            <div className="bg-[#1A1614] text-[#F5EDDD] p-8 font-mono text-sm">
              <div className="flex items-center justify-between gap-4 mb-8">
                <span className="text-[#F5EDDD]/40 text-xs uppercase tracking-wider">
                  Certificate of origin
                </span>
                <ScanLine className="w-4 h-4 text-[#B87333]" />
              </div>

              <dl className="space-y-4 text-xs">
                {[
                  ['Reference', 'KNA-TX-0114'],
                  ['Maker', 'Amí Lan · registered 2026'],
                  ['Buôn', 'Buôn Kli A, Đắk Lắk'],
                  ['Technique', 'Backstrap loom, natural dye'],
                  ['Time to make', '11 weeks'],
                  ['Reviewed by', 'Community Governance Committee'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-6 border-b border-[#F5EDDD]/10 pb-3">
                    <dt className="text-[#F5EDDD]/45 shrink-0">{k}</dt>
                    <dd className="text-right">{v}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-6 pt-1">
                  <dt className="text-[#F5EDDD]/45 shrink-0">To the maker</dt>
                  <dd className="text-[#E8A33D]">3,990,000 ₫ of 4,200,000 ₫</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ── FILTER ────────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 pt-16">
        <div className="border-y border-[#F5EDDD]/10 py-6 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3 flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-[#F5EDDD]/40 shrink-0" />
            <label htmlFor="mq" className="sr-only">Search the marketplace</label>
            <input
              id="mq"
              type="search"
              placeholder="Search a maker, a material, or a reference"
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
        </div>
      </section>

      {/* ── PRODUCTS ──────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-12 pb-24">
        <div className="text-sm text-[#F5EDDD]/50 mb-8">
          {shown.length} {shown.length === 1 ? 'piece' : 'pieces'} listed
        </div>

        {shown.length === 0 ? (
          <div className="border border-dashed border-[#F5EDDD]/20 py-20 text-center">
            <p className="font-display text-2xl mb-3">No pieces in that category yet.</p>
            <p className="text-sm text-[#F5EDDD]/60 mb-6">
              Makers list when a piece is finished, so stock moves slowly by design.
            </p>
            <button
              onClick={() => setCategory('All')}
              className="text-sm text-[#E8A33D] underline underline-offset-4"
            >
              See everything
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {shown.map((p) => (
              <article
                key={p.id}
                className="group border border-[#F5EDDD]/10 hover:border-[#F5EDDD]/30 transition flex flex-col"
              >
                <div className="relative">
                  <ImageSlot
                    ratio="aspect-square"
                    label={`${p.title} — ${p.maker}`}
                    className="border-0 border-b border-dashed"
                  />
                  {p.stock === 1 && (
                    <span className="absolute top-4 left-4 bg-[#C8302E] text-[#F5EDDD] text-[10px] uppercase tracking-[0.15em] px-3 py-1.5">
                      One of a kind
                    </span>
                  )}
                </div>

                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[#B87333]">
                      {p.category}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#E8A33D]">
                      <ShieldCheck className="w-3 h-3" />
                      Certified
                    </span>
                  </div>

                  <h3 className="font-display text-xl font-medium leading-tight mb-3">
                    {p.title}
                  </h3>

                  <p className="text-sm text-[#F5EDDD]/60 leading-relaxed mb-5 flex-1">
                    {p.note}
                  </p>

                  <dl className="text-xs text-[#F5EDDD]/50 space-y-2 mb-5">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <dd>{p.maker} · {p.buon}</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 shrink-0" />
                      <dd>{p.madeIn} to make</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <ScanLine className="w-3 h-3 shrink-0 text-[#B87333]" />
                      <dd className="font-mono">{p.id}</dd>
                    </div>
                  </dl>

                  <div className="border-t border-[#F5EDDD]/10 pt-4 mb-4">
                    <p className="text-[11px] text-[#F5EDDD]/45">
                      <span className="text-[#B87333]">To the maker · </span>
                      {vnd(Math.round(p.price * 0.95))}
                    </p>
                  </div>

                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <div className="font-display text-2xl text-[#E8A33D] leading-none">
                        {vnd(p.price)}
                      </div>
                      <div className="text-[11px] text-[#F5EDDD]/40 mt-1">
                        {p.stock === 1 ? 'Last one' : `${p.stock} available`}
                      </div>
                    </div>
                    <button className="group/btn inline-flex items-center gap-2 bg-[#C8302E] hover:bg-[#A82826] px-5 py-3 text-sm transition">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ── SHIPPING NOTE ─────────────────────────── */}
      <section className="bg-[#F5EDDD] text-[#1A1614]">
        <div className="px-8 lg:px-12 xl:px-16 py-20">
          <div className="grid md:grid-cols-12 gap-12">
            <div className="md:col-span-4">
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-[#C8302E] mb-6">
                <Info className="w-4 h-4" />
                Before you order
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-medium leading-[1.1] tracking-tight text-[#6B1A1A]">
                Handmade means slow, and sometimes means no.
              </h2>
            </div>

            <div className="md:col-span-8 grid sm:grid-cols-2 gap-10 pt-2">
              {[
                {
                  h: 'Stock is literal',
                  b: 'If a listing says one, there is one. Nothing here is reproduced to meet demand, and a maker may decline a repeat commission.',
                },
                {
                  h: 'Dispatch takes time',
                  b: 'Pieces ship from Đắk Lắk once a week. Allow two to three weeks within Vietnam, longer internationally.',
                },
                {
                  h: 'Some work is not for sale',
                  b: 'Certain ceremonial pieces are recorded in the cultural archive but never listed. The Committee decides what stays in the buôn.',
                },
                {
                  h: 'Prices are the maker\u2019s',
                  b: 'KNĂ does not discount, run sales, or negotiate on a maker\u2019s behalf. What you see is what they asked for.',
                },
              ].map((n) => (
                <div key={n.h}>
                  <h3 className="font-display text-lg font-medium mb-2 text-[#B87333]">{n.h}</h3>
                  <p className="text-sm text-[#1A1614]/65 leading-relaxed">{n.b}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="h-3 textile" />

      {/* ── HANDOFF ───────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-20 flex flex-wrap items-center justify-between gap-8">
        <div className="max-w-xl">
          <h2 className="font-display text-3xl md:text-4xl font-medium leading-tight mb-3">
            Not sure what you are looking at?
          </h2>
          <p className="text-[#F5EDDD]/70">
            The assistant can explain a motif, a technique, or what a piece is traditionally for.
          </p>
        </div>
        <a
          href="#assistant"
          className="group inline-flex items-center gap-3 bg-[#C8302E] hover:bg-[#A82826] px-8 py-4 transition"
        >
          Ask the assistant
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
        </a>
      </section>
    </div>
  );
}
