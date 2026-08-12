import React, { useState } from 'react';
import { ArrowRight, Play, Volume2, MapPin, Languages } from 'lucide-react';
import Navbar from './Navbar';
import ImageSlot from './ImageSlot';

const PILLARS = [
  {
    ede: 'Ching Kram',
    en: 'Cồng Chiêng',
    line: 'Recognised by UNESCO in 2005',
    body: 'A gong is not an instrument here. It is a voice. Each set is tuned to a family, played at births, harvests, and funerals, and read by listeners the way a letter is read.',
    entries: 34,
  },
  {
    ede: 'Knă',
    en: 'The Long House',
    line: 'Architecture of the matrilineal family',
    body: 'A house grows with its family. New sections are added as daughters marry, so the length of a longhouse records how many generations have lived under it.',
    entries: 21,
  },
  {
    ede: 'Mnga',
    en: 'Weaving',
    line: 'Pattern as written record',
    body: 'Motifs are not ornament. They mark clan, region, and the occasion a cloth was made for. A weaver reading another weaver\u2019s work can name the village it came from.',
    entries: 47,
  },
];

const ARCHIVE = [
  { type: 'Oral history', title: 'How the Ê Đê came to Đắk Lắk', meta: 'Narrated by Amí H\u2019Bia · 14 min', keeper: 'Buôn Akô Dhông' },
  { type: '360° tour', title: 'Inside a working longhouse', meta: 'Six rooms · walkthrough', keeper: 'Buôn Trấp' },
  { type: 'Recording', title: 'Gong set for the harvest ceremony', meta: 'Six players · 22 min', keeper: 'Buôn Đôn' },
  { type: 'Craft record', title: 'Backstrap loom, start to finish', meta: 'Photo essay · 40 frames', keeper: 'Buôn Kli A' },
  { type: 'Oral history', title: 'Why the mother\u2019s line holds the house', meta: 'Narrated by Aduôn Sun · 19 min', keeper: 'Buôn Akô Dhông' },
  { type: 'Language', title: 'Greetings and forms of address', meta: 'Audio · 12 phrases', keeper: 'Community Council' },
];

const PHRASES = [
  { ede: 'Hê drei', en: 'Hello', note: 'Used at any hour' },
  { ede: 'Bơni', en: 'Thank you', note: 'Said with a slight bow of the head' },
  { ede: 'Kâo bi mơak', en: 'I am glad to be here', note: 'Offered when entering a house' },
];

export default function Explore() {
  const [filter, setFilter] = useState('All');
  const types = ['All', ...new Set(ARCHIVE.map((a) => a.type))];
  const shown = filter === 'All' ? ARCHIVE : ARCHIVE.filter((a) => a.type === filter);

  return (
    <div className="min-h-screen bg-[#1A1614] text-[#F5EDDD] font-body antialiased">
      <Navbar active="Explore" theme="dark" />

      {/* ── OPENING ───────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-20 md:py-28 grid md:grid-cols-12 gap-12 items-end">
        <div className="md:col-span-7">
          <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-[#B87333] mb-8">
            <span className="h-px w-12 bg-[#B87333]" />
            <span>Digital Cultural Heritage Archive</span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-medium leading-[1.05] tracking-tight mb-8">
            A record kept by the people it belongs to.
          </h1>
          <p className="text-lg text-[#F5EDDD]/70 max-w-2xl leading-relaxed">
            Every recording, story, and photograph here was contributed by an Ê Đê household and
            reviewed by the Community Governance Committee before publication. Nothing is uploaded
            about the community without the community.
          </p>
        </div>
        <div className="md:col-span-5">
          <div className="border-l-2 border-[#B87333] pl-8 space-y-6">
            <div>
              <div className="font-display text-4xl font-medium text-[#B87333]">102</div>
              <p className="text-sm text-[#F5EDDD]/60">entries published</p>
            </div>
            <div>
              <div className="font-display text-4xl font-medium text-[#B87333]">7</div>
              <p className="text-sm text-[#F5EDDD]/60">buôn contributing</p>
            </div>
            <div>
              <div className="font-display text-4xl font-medium text-[#B87333]">VI · EN · Ê Đê</div>
              <p className="text-sm text-[#F5EDDD]/60">languages carried</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── THREE PILLARS ─────────────────────────── */}
      <section className="bg-[#F5EDDD] text-[#1A1614]">
        <div className="px-8 lg:px-12 xl:px-16 py-24">
          <div className="max-w-2xl mb-16">
            <div className="text-xs uppercase tracking-[0.25em] text-[#C8302E] mb-6">
              Where the archive begins
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight text-[#6B1A1A]">
              Three traditions carry most of what the Ê Đê know about themselves.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {PILLARS.map((p) => (
              <article key={p.en} className="flex flex-col">
                <ImageSlot
                  theme="light"
                  ratio="aspect-[4/5]"
                  label={`${p.en} — documentary photograph, vertical crop`}
                  className="mb-6"
                />
                <div className="font-display italic text-lg text-[#B87333] mb-1">{p.ede}</div>
                <h3 className="font-display text-2xl font-medium mb-2 leading-tight">{p.en}</h3>
                <p className="text-xs uppercase tracking-[0.15em] text-[#1A1614]/50 mb-4">
                  {p.line}
                </p>
                <p className="text-sm text-[#1A1614]/70 leading-relaxed mb-6 flex-1">{p.body}</p>
                <a
                  href="#"
                  className="group inline-flex items-center gap-2 text-sm text-[#C8302E] border-t border-[#1A1614]/10 pt-4"
                >
                  {p.entries} entries
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── LISTENING ROOM ────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-24 grid md:grid-cols-12 gap-12 items-center">
        <div className="md:col-span-5">
          <div className="text-xs uppercase tracking-[0.25em] text-[#B87333] mb-6">
            The listening room
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight mb-8">
            Hear it before you arrive.
          </h2>
          <p className="text-lg text-[#F5EDDD]/70 leading-relaxed mb-8">
            Gong sets are tuned by ear and by family, so no two villages sound alike. These
            recordings were made in the buôn, during real ceremonies, with the households&rsquo;
            permission.
          </p>
          <button className="group inline-flex items-center gap-3 border border-[#F5EDDD]/30 hover:border-[#F5EDDD]/70 px-6 py-3 transition">
            <Volume2 className="w-4 h-4" />
            Open the listening room
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </button>
        </div>

        <div className="md:col-span-7 space-y-3">
          {[
            { title: 'Harvest ceremony, full set', place: 'Buôn Đôn', len: '22:14' },
            { title: 'Funeral gongs, slow cycle', place: 'Buôn Trấp', len: '17:02' },
            { title: 'Welcome pattern for guests', place: 'Buôn Akô Dhông', len: '06:48' },
            { title: 'Teaching session, young players', place: 'Buôn Kli A', len: '31:20' },
          ].map((t) => (
            <div
              key={t.title}
              className="group flex items-center gap-6 border border-[#F5EDDD]/10 hover:border-[#F5EDDD]/30 p-5 transition cursor-pointer"
            >
              <div className="w-10 h-10 border border-[#B87333] flex items-center justify-center shrink-0 group-hover:bg-[#B87333] transition">
                <Play className="w-3.5 h-3.5 text-[#B87333] group-hover:text-[#1A1614] transition" fill="currentColor" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-lg leading-tight">{t.title}</div>
                <div className="text-xs text-[#F5EDDD]/50 mt-1">Recorded in {t.place}</div>
              </div>
              <div className="font-mono text-xs text-[#E8A33D] shrink-0">{t.len}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── ARCHIVE INDEX ─────────────────────────── */}
      <section className="bg-[#F5EDDD] text-[#1A1614]">
        <div className="px-8 lg:px-12 xl:px-16 py-24">
          <div className="flex flex-wrap items-end justify-between gap-8 mb-12">
            <div className="max-w-xl">
              <div className="text-xs uppercase tracking-[0.25em] text-[#C8302E] mb-6">
                Browse the archive
              </div>
              <h2 className="font-display text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight text-[#6B1A1A]">
                Everything, indexed by the household that shared it.
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {types.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`px-4 py-2 text-xs uppercase tracking-wider border transition ${
                    filter === t
                      ? 'bg-[#1A1614] text-[#F5EDDD] border-[#1A1614]'
                      : 'border-[#1A1614]/25 hover:border-[#1A1614]/60'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {shown.map((item) => (
              <article key={item.title} className="group cursor-pointer">
                <ImageSlot
                  theme="light"
                  ratio="aspect-[3/2]"
                  label={`${item.type} — ${item.title}`}
                  className="mb-5"
                />
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#B87333] mb-2">
                  {item.type}
                </div>
                <h3 className="font-display text-xl font-medium leading-tight mb-2 group-hover:text-[#C8302E] transition">
                  {item.title}
                </h3>
                <p className="text-sm text-[#1A1614]/60 mb-3">{item.meta}</p>
                <div className="flex items-center gap-2 text-xs text-[#1A1614]/50">
                  <MapPin className="w-3 h-3" />
                  Contributed by {item.keeper}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── LANGUAGE ──────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-24 grid md:grid-cols-12 gap-12 items-center">
        <div className="md:col-span-6 order-2 md:order-1 space-y-3">
          {PHRASES.map((p) => (
            <div
              key={p.ede}
              className="flex items-baseline gap-6 border-b border-[#F5EDDD]/10 pb-4"
            >
              <div className="font-display text-2xl italic text-[#E8A33D] w-40 shrink-0">
                {p.ede}
              </div>
              <div className="flex-1">
                <div className="text-base">{p.en}</div>
                <div className="text-xs text-[#F5EDDD]/50 mt-1">{p.note}</div>
              </div>
              <button className="text-[#B87333] hover:text-[#E8A33D] transition shrink-0">
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="md:col-span-6 order-1 md:order-2">
          <div className="text-xs uppercase tracking-[0.25em] text-[#B87333] mb-6">
            Before you go
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight mb-8">
            Twelve phrases change how you are received.
          </h2>
          <p className="text-lg text-[#F5EDDD]/70 leading-relaxed mb-8">
            The Ê Đê language is spoken daily in the buôn but rarely by visitors. Learning even a
            greeting signals that you came to meet people rather than to look at them.
          </p>
          <button className="group inline-flex items-center gap-3 bg-[#C8302E] hover:bg-[#A82826] px-6 py-3 transition">
            <Languages className="w-4 h-4" />
            Start the phrasebook
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </button>
        </div>
      </section>

      {/* ── HANDOFF ───────────────────────────────── */}
      <section className="bg-[#F5EDDD] text-[#1A1614]">
        <div className="px-8 lg:px-12 xl:px-16 py-20 flex flex-wrap items-center justify-between gap-8">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl md:text-4xl font-medium leading-tight text-[#6B1A1A] mb-3">
              Read enough. Ready to visit?
            </h2>
            <p className="text-[#1A1614]/70">
              Every household in this archive also hosts, guides, or sells through KNĂ.
            </p>
          </div>
          <a
            href="#travel"
            className="group inline-flex items-center gap-3 bg-[#1A1614] text-[#F5EDDD] px-8 py-4 hover:bg-black transition"
          >
            See experiences
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </a>
        </div>
      </section>
    </div>
  );
}
