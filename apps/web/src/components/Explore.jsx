import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Volume2, MapPin, Languages } from 'lucide-react';
import Navbar from './Navbar';
import ImageSlot from './ImageSlot';
import VietnamMap from './VietnamMap';
import { api } from '../lib/api';
import ApiErrorNotice from './ApiErrorNotice';

// Leaflet and its stylesheet are about 45KB gzipped and are needed on this
// screen only. Split out so the landing page, which most visitors see first
// and some see on mobile data, does not carry them.
const SatelliteMap = lazy(() => import('./SatelliteMap'));

export default function Explore() {
  const { t } = useTranslation();
  // Prose for the three groupings lives in the locale files; the counts
  // underneath come from the API, being a measurement of what the
  // Committee has actually published.
  const pillars = t('explore.pillars', { returnObjects: true });
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
            <span>{t('explore.eyebrow')}</span>
          </div>
          <h1 className="font-display page-title font-medium leading-[1.05] tracking-tight mb-8">
            {t('explore.title')}
          </h1>
          <p className="text-lg text-[#F5EDDD]/70 max-w-2xl leading-relaxed">
            {t('explore.intro')}
          </p>
        </div>
        <div className="md:col-span-5">
          <div className="border-l-2 border-[#B87333] pl-8 space-y-6">
            <div>
              <div className="font-display text-4xl font-medium text-[#B87333]">
                {stats ? stats.publishedEntries : '—'}
              </div>
              <p className="text-sm text-[#F5EDDD]/60">{t('explore.statEntries')}</p>
            </div>
            <div>
              <div className="font-display text-4xl font-medium text-[#B87333]">
                {stats ? stats.contributingBuon : '—'}
              </div>
              <p className="text-sm text-[#F5EDDD]/60">{t('explore.statBuon')}</p>
            </div>
            <div>
              <div className="font-display text-4xl font-medium text-[#B87333]">VI · EN · Ê Đê</div>
              <p className="text-sm text-[#F5EDDD]/60">{t('explore.statLanguages')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHERE ─────────────────────────────────── */}
      {/* Between the opening and the pillars because everything after this
          point assumes you know where Đắk Lắk is, and most readers do not. */}
      <section className="border-t border-[#F5EDDD]/10">
        <div className="px-8 lg:px-12 xl:px-16 py-20 md:py-24 grid md:grid-cols-12 gap-12 items-start">
          <div className="md:col-span-4">
            <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-[#B87333] mb-8">
              <span className="h-px w-12 bg-[#B87333]" />
              <span>{t('explore.map.eyebrow')}</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-medium leading-[1.1] tracking-tight mb-6">
              {t('explore.map.heading')}
            </h2>
            <p className="text-[#F5EDDD]/70 leading-relaxed mb-8">{t('explore.map.body')}</p>

            <dl className="space-y-3 text-sm">
              <div className="flex gap-4">
                <dt className="text-[#F5EDDD]/45 w-28 shrink-0">{t('explore.map.regionLabel')}</dt>
                <dd className="text-[#F5EDDD]/80">{t('explore.map.regionValue')}</dd>
              </div>
              <div className="flex gap-4">
                <dt className="text-[#F5EDDD]/45 w-28 shrink-0">{t('explore.map.capitalLabel')}</dt>
                <dd className="text-[#F5EDDD]/80">{t('explore.map.capitalValue')}</dd>
              </div>
              <div className="flex gap-4">
                <dt className="text-[#F5EDDD]/45 w-28 shrink-0">{t('explore.map.gettingLabel')}</dt>
                <dd className="text-[#F5EDDD]/80">{t('explore.map.gettingValue')}</dd>
              </div>
            </dl>
          </div>

          <div className="md:col-span-8 grid sm:grid-cols-2 gap-8">
            {/* Two maps, two questions. The outline says where the province
                is and needs nothing from the network; the satellite says
                what it looks like and needs everything from it. Neither
                answers for the other, which is why both are here. */}
            <figure>
              <VietnamMap />
              <figcaption className="text-xs text-[#F5EDDD]/40 leading-relaxed mt-4">
                {t('explore.map.caption')}
              </figcaption>
            </figure>
            <figure>
              <Suspense
                fallback={<div className="w-full aspect-square rounded-sm bg-[#241F1C]" />}
              >
                <SatelliteMap />
              </Suspense>
              <figcaption className="text-xs text-[#F5EDDD]/40 leading-relaxed mt-4">
                {t('explore.map.satelliteCaption')}
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ── THREE PILLARS ─────────────────────────── */}
      <section className="bg-[#F5EDDD] text-[#1A1614]">
        <div className="px-8 lg:px-12 xl:px-16 py-24">
          {/* Wide enough for the heading to sit on one line at md and up.
              It started at max-w-2xl, which broke it across four. */}
          <div className="max-w-4xl mb-16">
            <div className="text-xs uppercase tracking-[0.25em] text-[#C8302E] mb-6">
              {t('explore.pillarsEyebrow')}
            </div>
            <h2 className="font-display section-title font-medium leading-[1.1] tracking-tight text-[#6B1A1A]">
              {t('explore.pillarsHeading')}
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {pillars.map((p) => {
              const count = pillarCounts[p.en] ?? 0;
              return (
                <article key={p.en} className="flex flex-col">
                  <ImageSlot
                    src={p.image}
                    alt={p.alt}
                    position={p.position}
                    theme="light"
                    ratio="aspect-[4/5]"
                    label={t('explore.photoLabel', { name: p.en })}
                    className="mb-6"
                  />
                  <div className="font-display italic text-lg text-[#B87333] mb-1">{p.ede}</div>
                  <h3 className="font-display text-2xl font-medium mb-2 leading-tight">{p.en}</h3>
                  <p className="text-xs uppercase tracking-[0.15em] text-[#1A1614]/50 mb-4">
                    {p.line}
                  </p>
                  <p className="text-sm text-[#1A1614]/70 leading-relaxed mb-6 flex-1">{p.body}</p>
                  <div className="border-t border-[#1A1614]/10 pt-4 text-sm text-[#C8302E]">
                    {t('explore.entriesPublished', { count })}
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
              {t('explore.browseEyebrow')}
            </div>
            <h2 className="font-display section-title font-medium leading-[1.1] tracking-tight">
              {t('explore.browseHeading')}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={`px-4 py-2 text-xs uppercase tracking-wider border transition ${
                  filter === option
                    ? 'bg-[#F5EDDD] text-[#1A1614] border-[#F5EDDD]'
                    : 'border-[#F5EDDD]/25 hover:border-[#F5EDDD]/60'
                }`}
              >
                {option === 'All' ? t('explore.filterAll') : option}
              </button>
            ))}
          </div>
        </div>

        {loadState === 'loading' && (
          <div className="text-sm text-[#F5EDDD]/50 py-20 text-center">{t('explore.loading')}</div>
        )}

        {loadState === 'error' && (
          <ApiErrorNotice />
        )}

        {loadState === 'ready' &&
          (entries.length === 0 ? (
            <div className="border border-dashed border-[#F5EDDD]/20 py-20 text-center">
              <p className="font-display text-2xl mb-3">{t('explore.emptyCategory')}</p>
              <button
                onClick={() => setFilter('All')}
                className="text-sm text-[#E8A33D] underline underline-offset-4"
              >
                {t('explore.seeEverything')}
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {entries.map((item) => (
                <article key={item.id} className="group">
                  <ImageSlot
                    src={item.imageUrl}
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
                    {t('explore.contributedBy', { buon: item.keeperBuon })}
                  </div>
                </article>
              ))}
            </div>
          ))}

        <div className="border border-[#B87333]/40 bg-[#B87333]/5 px-6 py-4 mt-12">
          <p className="text-sm text-[#F5EDDD]/70 leading-relaxed">
            <span className="text-[#B87333] uppercase tracking-wider text-xs">{t('explore.mediaPendingLabel')}</span>
            {t('explore.mediaPendingBody')}
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
              {t('explore.phrasesEyebrow')}
            </div>
            <h2 className="font-display section-title font-medium leading-[1.1] tracking-tight text-[#6B1A1A] mb-8">
              {t('explore.phrasesHeading', { count: phrases.length })}
            </h2>
            <p className="text-lg text-[#1A1614]/70 leading-relaxed mb-6">
              {t('explore.phrasesBody')}
            </p>
            <p className="text-sm text-[#1A1614]/55 leading-relaxed flex items-start gap-2">
              <Languages className="w-4 h-4 shrink-0 mt-0.5" />
              {t('explore.phrasesScope')}
            </p>
            <p className="text-sm text-[#1A1614]/45 leading-relaxed flex items-start gap-2 mt-3">
              <Volume2 className="w-4 h-4 shrink-0 mt-0.5" />
              {t('explore.phrasesAudio')}
            </p>
          </div>
        </div>
      </section>

      <div className="h-3 textile" />

      {/* ── HANDOFF ───────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-20 flex flex-wrap items-center justify-between gap-8">
        <div className="max-w-xl">
          <h2 className="font-display text-3xl md:text-4xl font-medium leading-tight mb-3">
            {t('explore.handoffHeading')}
          </h2>
          <p className="text-[#F5EDDD]/70">
            {t('explore.handoffBody')}
          </p>
        </div>
        <a
          href="#travel"
          className="group inline-flex items-center gap-3 bg-[#C8302E] hover:bg-[#A82826] px-8 py-4 transition"
        >
          {t('explore.handoffCta')}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
        </a>
      </section>
    </div>
  );
}
