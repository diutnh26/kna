import { useEffect, useState } from 'react';
import { ArrowRight, Volume2, MapPin, Languages } from 'lucide-react';
import Navbar from './Navbar';
import ImageSlot from './ImageSlot';
import { api } from '../lib/api';
import ApiErrorNotice from './ApiErrorNotice';

// The three editorial groupings the archive is organised around. The prose
// is fixed; the entry counts underneath come from the API, since they're a
// measurement of what the Committee has actually published.
const PILLARS = [
  {
    ede: 'Ching Kram',
    en: 'Cồng Chiêng',
    line: 'Recognised by UNESCO in 2005',
    body: 'A gong is not an instrument here. It is a voice. Each set is tuned to a family, played at births, harvests, and funerals, and read by listeners the way a letter is read.',
  },
  {
    ede: 'Knă',
    en: 'The Long House',
    line: 'Architecture of the matrilineal family',
    body: 'A house grows with its family. New sections are added as daughters marry, so the length of a longhouse records how many generations have lived under it.',
  },
  {
    ede: 'Mnga',
    en: 'Weaving',
    line: 'Pattern as written record',
    body: 'Motifs are not ornament. They mark clan, region, and the occasion a cloth was made for. A weaver reading another weaver’s work can name the village it came from.',
  },
];

export default function Explore() {
  const [filter, setFilter] = useState('All');
  const [entries, setEntries] = useState([]);
  const [types, setTypes] = useState([]);
  const [pillarCounts, setPillarCounts] = useState({});
  const [phrases, setPhrases] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'error'

  // Reference data — fetched once.
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.archiveTypes(), api.archivePillars(), api.archivePhrases(), api.archiveStats()])
      .then(([typeData, pillarData, phraseData, statsData]) => {
        if (cancelled) return;
        setTypes(typeData.map((t) => t.type));
        setPillarCounts(Object.fromEntries(pillarData.map((p) => [p.pillar, p.count])));
        setPhrases(phraseData);
        setStats(statsData);
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Entries — refetched when the type filter changes.
  useEffect(() => {
    let cancelled = false;
    api
      .archive({ type: filter })
      .then((data) => {
        if (cancelled) return;
        setEntries(data);
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  const filterOptions = ['All', ...types];

  return (
    <div className="min-h-screen bg-[#1A1614] text-[#F5EDDD] font-body antialiased">
      <Navbar active="explore" theme="dark" />

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
              <div className="font-display text-4xl font-medium text-[#B87333]">
                {stats ? stats.publishedEntries : '—'}
              </div>
              <p className="text-sm text-[#F5EDDD]/60">entries published</p>
            </div>
            <div>
              <div className="font-display text-4xl font-medium text-[#B87333]">
                {stats ? stats.contributingBuon : '—'}
              </div>
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
            {PILLARS.map((p) => {
              const count = pillarCounts[p.en] ?? 0;
              return (
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
                  <div className="border-t border-[#1A1614]/10 pt-4 text-sm text-[#C8302E]">
                    {count} {count === 1 ? 'entry' : 'entries'} published
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── ARCHIVE INDEX ─────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-24">
        <div className="flex flex-wrap items-end justify-between gap-8 mb-12">
          <div className="max-w-xl">
            <div className="text-xs uppercase tracking-[0.25em] text-[#B87333] mb-6">
              Browse the archive
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight">
              Everything, indexed by the household that shared it.
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-4 py-2 text-xs uppercase tracking-wider border transition ${
                  filter === t
                    ? 'bg-[#F5EDDD] text-[#1A1614] border-[#F5EDDD]'
                    : 'border-[#F5EDDD]/25 hover:border-[#F5EDDD]/60'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {loadState === 'loading' && (
          <div className="text-sm text-[#F5EDDD]/50 py-20 text-center">Loading the archive…</div>
        )}

        {loadState === 'error' && (
          <ApiErrorNotice />
        )}

        {loadState === 'ready' &&
          (entries.length === 0 ? (
            <div className="border border-dashed border-[#F5EDDD]/20 py-20 text-center">
              <p className="font-display text-2xl mb-3">Nothing published in that category yet.</p>
              <button
                onClick={() => setFilter('All')}
                className="text-sm text-[#E8A33D] underline underline-offset-4"
              >
                See everything
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {entries.map((item) => (
                <article key={item.id} className="group">
                  <ImageSlot
                    ratio="aspect-[3/2]"
                    label={`${item.type} — ${item.title}`}
                    className="mb-5"
                  />
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#B87333] mb-2">
                    {item.type}
                  </div>
                  <h3 className="font-display text-xl font-medium leading-tight mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-[#F5EDDD]/60 mb-3">{item.meta}</p>
                  <div className="flex items-center gap-2 text-xs text-[#F5EDDD]/50">
                    <MapPin className="w-3 h-3" />
                    Contributed by {item.keeperBuon}
                  </div>
                </article>
              ))}
            </div>
          ))}

        <div className="border border-[#B87333]/40 bg-[#B87333]/5 px-6 py-4 mt-12">
          <p className="text-sm text-[#F5EDDD]/70 leading-relaxed">
            <span className="text-[#B87333] uppercase tracking-wider text-xs">Media pending · </span>
            Entry records are live and moderated. The audio, 360° tours, and photo essays
            themselves are not hosted yet — media storage is the next piece of this screen.
          </p>
        </div>
      </section>

      {/* ── LANGUAGE ──────────────────────────────── */}
      <section className="bg-[#F5EDDD] text-[#1A1614]">
        <div className="px-8 lg:px-12 xl:px-16 py-24 grid md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-6 order-2 md:order-1 space-y-3">
            {phrases.map((p) => (
              <div
                key={p.id}
                className="flex items-baseline gap-6 border-b border-[#1A1614]/10 pb-4"
              >
                <div className="font-display text-2xl italic text-[#C8302E] w-40 shrink-0">
                  {p.ede}
                </div>
                <div className="flex-1">
                  <div className="text-base">{p.en}</div>
                  <div className="text-xs text-[#1A1614]/55 mt-1">{p.note}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="md:col-span-6 order-1 md:order-2">
            <div className="text-xs uppercase tracking-[0.25em] text-[#C8302E] mb-6">
              Before you go
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight text-[#6B1A1A] mb-8">
              {phrases.length} phrases change how you are received.
            </h2>
            <p className="text-lg text-[#1A1614]/70 leading-relaxed mb-6">
              The Ê Đê language is spoken daily in the buôn but rarely by visitors. Learning even a
              greeting signals that you came to meet people rather than to look at them.
            </p>
            <p className="text-sm text-[#1A1614]/55 leading-relaxed flex items-start gap-2">
              <Languages className="w-4 h-4 shrink-0 mt-0.5" />
              Everyday speech is published by decision of the Committee, April 2026. Ceremonial and
              clan-specific speech is not, and will not appear here.
            </p>
            <p className="text-sm text-[#1A1614]/45 leading-relaxed flex items-start gap-2 mt-3">
              <Volume2 className="w-4 h-4 shrink-0 mt-0.5" />
              Pronunciation audio is recorded but not yet hosted.
            </p>
          </div>
        </div>
      </section>

      <div className="h-3 textile" />

      {/* ── HANDOFF ───────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-20 flex flex-wrap items-center justify-between gap-8">
        <div className="max-w-xl">
          <h2 className="font-display text-3xl md:text-4xl font-medium leading-tight mb-3">
            Read enough. Ready to visit?
          </h2>
          <p className="text-[#F5EDDD]/70">
            Every household in this archive also hosts, guides, or sells through KNĂ.
          </p>
        </div>
        <a
          href="#travel"
          className="group inline-flex items-center gap-3 bg-[#C8302E] hover:bg-[#A82826] px-8 py-4 transition"
        >
          See experiences
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
        </a>
      </section>
    </div>
  );
}
