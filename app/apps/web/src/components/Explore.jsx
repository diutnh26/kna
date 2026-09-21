import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Volume2, MapPin, Languages, Award, Users, Hand } from 'lucide-react';
import Navbar from './Navbar';
import EthnicitySwitcher from './EthnicitySwitcher';
import ImageSlot from './ImageSlot';
import VietnamMap from './VietnamMap';
import { api } from '../lib/api';
import ApiErrorNotice from './ApiErrorNotice';
import { useEthnicity } from '../context/useEthnicity';
import { ADDITIONAL_PHRASES } from '../content/ethnicities';

// Leaflet and its stylesheet are about 45KB gzipped and are needed on this
// screen only. Split out so the landing page, which most visitors see first
// and some see on mobile data, does not carry them.
const InteractiveMap = lazy(() => import('./InteractiveMap'));

export default function Explore() {
  const { t, i18n } = useTranslation();
  const { slug, ethnicity, generation } = useEthnicity();
  const lang = i18n.resolvedLanguage === 'vi' ? 'vi' : 'en';

  const [filter, setFilter] = useState('All');
  const [entries, setEntries] = useState([]);
  const [types, setTypes] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'error'

  // The archive index is database-backed and, so far, entirely Ê Đê. The
  // other four profiles are compiled from research, so there is nothing
  // published under them and the section says so rather than showing an
  // empty grid that reads as a loading failure.
  const archiveOpen = ethnicity.provenance === 'community';

  const panelRef = useRef(null);
  const [heldHeight, setHeldHeight] = useState(null);

  // Profiles carry different numbers of traditions, places and phrases, so
  // the panel's height changes between them. Pin the outgoing height across
  // the swap and release it on the next frame, or the page collapses and
  // reflows under the reader halfway through the crossfade.
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el || generation === 0) return undefined;
    setHeldHeight(el.offsetHeight);
    const timer = setTimeout(() => setHeldHeight(null), 340);
    return () => clearTimeout(timer);
  }, [generation]);

  // Reference data — fetched once.
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.archiveTypes(), api.archiveStats()])
      .then(([typeData, statsData]) => {
        if (cancelled) return;
        setTypes(typeData.map((item) => item.type));
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
  const place = ethnicity.places[0];

  return (
    <div className="min-h-screen bg-ink text-bone font-body antialiased">
      <Navbar active="explore" theme="dark" />
      <EthnicitySwitcher theme="dark" />

      {/* Everything below the switcher is what changes. `key` drives the
          CSS fallback animation where View Transitions are missing; the
          view-transition-name gives the browser something to crossfade
          where they are not. */}
      <div
        ref={panelRef}
        key={generation}
        className="ethnicity-panel ethnicity-enter"
        style={{
          minHeight: heldHeight ?? undefined,
          viewTransitionName: 'ethnicity',
        }}
      >
        {/* ── OPENING ───────────────────────────────── */}
        <section className="px-8 lg:px-12 xl:px-16 py-20 md:py-28 grid md:grid-cols-12 gap-12 items-end">
          <div className="md:col-span-7">
            <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-copper mb-8">
              <span className="h-px w-12 bg-copper" />
              <span>{t('explore.eyebrow')}</span>
            </div>
            <h1 className="font-display page-title font-medium leading-[1.05] tracking-tight mb-4">
              {ethnicity.name[lang]} — {ethnicity.region[lang]}
            </h1>
            <p className="font-display italic text-xl text-copper mb-8">{ethnicity.endonym}</p>
            <p className="text-lg text-bone/70 max-w-2xl leading-relaxed">
              {ethnicity.intro[lang]}
            </p>

            {/* Who says so. The Ê Đê profile went through the Committee;
                the other four are compiled from a research report, and
                conflating the two would undo the thing this platform is
                actually claiming. */}
            <p className="mt-8 inline-flex items-start gap-2 text-sm text-bone/50 border-l-2 border-copper/40 pl-4">
              <Hand className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {t(`explore.provenance.${ethnicity.provenance}`)}
                {ethnicity.sources.length > 0 && (
                  <span className="text-bone/35"> · {ethnicity.sources.join(' · ')}</span>
                )}
              </span>
            </p>
          </div>

          <div className="md:col-span-5">
            <div className="border-l-2 border-copper pl-8 space-y-6">
              {place?.households ? (
                <div>
                  <div className="font-display text-4xl font-medium text-copper">
                    {place.households}+
                  </div>
                  <p className="text-sm text-bone/60">{t('explore.statHouseholds')}</p>
                </div>
              ) : null}
              {place?.homestays ? (
                <div>
                  <div className="font-display text-4xl font-medium text-copper">
                    {place.homestays}
                  </div>
                  <p className="text-sm text-bone/60">{t('explore.statHomestays')}</p>
                </div>
              ) : null}
              {archiveOpen && (
                <div>
                  <div className="font-display text-4xl font-medium text-copper">
                    {stats ? stats.publishedEntries : '—'}
                  </div>
                  <p className="text-sm text-bone/60">{t('explore.statEntries')}</p>
                </div>
              )}
              <div>
                <div className="font-display text-4xl font-medium text-copper">
                  VI · EN · {ethnicity.name[lang]}
                </div>
                <p className="text-sm text-bone/60">{t('explore.statLanguages')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── WHERE ─────────────────────────────────── */}
        {/* Between the opening and the traditions because everything after
            this point assumes you know where this is, and most readers do
            not. */}
        <section className="border-t border-bone/10">
          <div className="px-8 lg:px-12 xl:px-16 py-20 md:py-24 grid md:grid-cols-12 gap-12 items-start">
            <div className="md:col-span-4">
              <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-copper mb-8">
                <span className="h-px w-12 bg-copper" />
                <span>{t('explore.map.eyebrow')}</span>
              </div>

              {place && (
                <>
                  {/* The village's own name. It was missing here at first —
                      the blurb and the administrative fields were shown but
                      never the thing they describe, so the section named
                      every province except the place the reader came for. */}
                  <h3 className="font-display text-2xl font-medium mb-3 leading-tight">
                    {place.name}
                  </h3>
                  <p className="text-bone/70 leading-relaxed mb-8">{place.blurb[lang]}</p>
                  <dl className="space-y-3 text-sm">
                    <div className="flex gap-4">
                      <dt className="text-bone/45 w-28 shrink-0">
                        {t('explore.map.regionLabel')}
                      </dt>
                      <dd className="text-bone/80">{ethnicity.region[lang]}</dd>
                    </div>
                    <div className="flex gap-4">
                      <dt className="text-bone/45 w-28 shrink-0">
                        {t('explore.map.districtLabel')}
                      </dt>
                      <dd className="text-bone/80">{place.district}</dd>
                    </div>
                    <div className="flex gap-4">
                      <dt className="text-bone/45 w-28 shrink-0">
                        {t('explore.map.provinceLabel')}
                      </dt>
                      <dd className="text-bone/80">{place.province}</dd>
                    </div>
                  </dl>

                  {place.recognition && (
                    <div className="mt-8 flex items-start gap-3 border border-amber/40 bg-amber/5 px-5 py-4">
                      <Award className="w-5 h-5 shrink-0 text-amber mt-0.5" />
                      <p className="text-sm text-bone/75 leading-relaxed">
                        {place.recognition[lang]}
                      </p>
                    </div>
                  )}
                </>
              )}

              {ethnicity.places.length > 1 && (
                <div className="mt-8 border-t border-bone/10 pt-6">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-bone/40 mb-4">
                    {t('explore.otherPlaces')}
                  </div>
                  <ul className="space-y-4">
                    {ethnicity.places.slice(1).map((other) => (
                      <li key={other.name}>
                        <div className="text-sm text-bone/85 flex items-center gap-2">
                          <MapPin className="w-3 h-3 text-copper shrink-0" />
                          {other.name}
                        </div>
                        <p className="text-xs text-bone/50 mt-1 leading-relaxed">
                          {other.blurb[lang]}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="md:col-span-8 grid sm:grid-cols-2 gap-8">
              {/* Two maps, two questions. The outline says where the place
                  is, as a shape, and needs nothing from the network; the
                  live map has the roads and towns and zooms out to the
                  country, and needs everything from it. Neither answers
                  for the other. */}
              <div>
                <VietnamMap />
              </div>
              <Suspense fallback={<div className="w-full aspect-square rounded-sm bg-ink-raised" />}>
                <InteractiveMap />
              </Suspense>
            </div>
          </div>
        </section>

        {/* ── TRADITIONS ────────────────────────────── */}
        <section className="bg-bone text-ink">
          <div className="px-8 lg:px-12 xl:px-16 py-24">
            <div className="max-w-4xl mb-16">
              <div className="text-xs uppercase tracking-[0.25em] text-kteh mb-6">
                {t('explore.pillarsEyebrow')}
              </div>
              <h2 className="font-display section-title font-medium leading-[1.1] tracking-tight text-deep">
                {t('explore.pillarsHeadingFor', {
                  name: ethnicity.name[lang],
                  count: ethnicity.identity.length,
                })}
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-10">
              {ethnicity.identity.map((item) => (
                <article key={item.key} className="flex flex-col">
                  <ImageSlot
                    src={item.image.src}
                    alt={item.image.alt[lang]}
                    theme="light"
                    ratio="aspect-[4/5]"
                    label={t('explore.photoLabel', { name: item.title[lang] })}
                    className="mb-4"
                  />

                  {/* Author, licence, and — where it applies — the fact
                      that the photograph is of the right people in the
                      wrong place. A caption, not a footnote: these are
                      placeholders until the community sends its own. */}
                  <p className="text-[10px] leading-relaxed text-ink/45 mb-5">
                    <a
                      href={item.image.credit.source}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2 hover:text-ink/70"
                    >
                      {item.image.credit.author}
                    </a>
                    {' · '}
                    {item.image.credit.license}
                    {item.image.credit.note && (
                      <span className="block text-kteh/70 mt-1">
                        {item.image.credit.note[lang]}
                      </span>
                    )}
                  </p>

                  <div className="font-display italic text-lg text-copper mb-1">{item.native}</div>
                  <h3 className="font-display text-2xl font-medium mb-2 leading-tight">
                    {item.title[lang]}
                  </h3>
                  <p className="text-xs uppercase tracking-[0.15em] text-ink/50 mb-4">
                    {item.line[lang]}
                  </p>
                  <p className="text-sm text-ink/70 leading-relaxed flex-1">{item.body[lang]}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── EXPERIENCES ───────────────────────────── */}
        <section className="px-8 lg:px-12 xl:px-16 py-24">
          <div className="max-w-2xl mb-12">
            <div className="text-xs uppercase tracking-[0.25em] text-copper mb-6">
              {t('explore.experiencesEyebrow')}
            </div>
            <h2 className="font-display section-title font-medium leading-[1.1] tracking-tight">
              {t('explore.experiencesHeading')}
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8">
            {ethnicity.experiences.map((item) => (
              <article key={item.title.en} className="border-t border-bone/15 pt-5">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h3 className="font-display text-xl font-medium leading-tight">
                    {item.title[lang]}
                  </h3>
                  {item.season && (
                    <span className="text-[10px] uppercase tracking-wider text-amber border border-amber/40 px-2 py-0.5 shrink-0">
                      {item.season[lang]}
                    </span>
                  )}
                </div>
                <p className="text-sm text-bone/60 leading-relaxed">{item.body[lang]}</p>
              </article>
            ))}
          </div>

          {ethnicity.institutions.length > 0 && (
            <div className="mt-16 border-t border-bone/10 pt-8">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-bone/40 mb-6">
                <Users className="w-3.5 h-3.5" />
                {t('explore.institutionsLabel')}
              </div>
              <div className="grid md:grid-cols-2 gap-8 max-w-4xl">
                {ethnicity.institutions.map((org) => {
                  const name = typeof org.name === 'string' ? org.name : org.name[lang];
                  return (
                    <div key={name}>
                      <div className="font-display text-lg text-copper mb-1">{name}</div>
                      <p className="text-sm text-bone/60 leading-relaxed">{org.role[lang]}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* ── ARCHIVE INDEX ─────────────────────────── */}
        <section className="px-8 lg:px-12 xl:px-16 pb-24">
          <div className="flex flex-wrap items-end justify-between gap-8 mb-12">
            <div className="max-w-xl">
              <div className="text-xs uppercase tracking-[0.25em] text-copper mb-6">
                {t('explore.browseEyebrow')}
              </div>
              <h2 className="font-display section-title font-medium leading-[1.1] tracking-tight">
                {t('explore.browseHeading')}
              </h2>
            </div>
            {archiveOpen && (
              <div className="flex flex-wrap gap-2">
                {filterOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => setFilter(option)}
                    className={`px-4 py-2 text-xs uppercase tracking-wider border transition ${
                      filter === option
                        ? 'bg-bone text-ink border-bone'
                        : 'border-bone/25 hover:border-bone/60'
                    }`}
                  >
                    {option === 'All' ? t('explore.filterAll') : option}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!archiveOpen ? (
            <div className="border border-dashed border-bone/20 py-16 px-8 text-center max-w-2xl mx-auto">
              <p className="font-display text-2xl mb-3">{t('explore.archiveNotOpenTitle')}</p>
              <p className="text-sm text-bone/55 leading-relaxed">
                {t('explore.archiveNotOpenBody', { name: ethnicity.name[lang] })}
              </p>
            </div>
          ) : (
            <>
              {loadState === 'loading' && (
                <div className="text-sm text-bone/50 py-20 text-center">
                  {t('explore.loading')}
                </div>
              )}

              {loadState === 'error' && <ApiErrorNotice />}

              {loadState === 'ready' &&
                (entries.length === 0 ? (
                  <div className="border border-dashed border-bone/20 py-20 text-center">
                    <p className="font-display text-2xl mb-3">{t('explore.emptyCategory')}</p>
                    <button
                      onClick={() => setFilter('All')}
                      className="text-sm text-amber underline underline-offset-4"
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
                        <div className="text-[10px] uppercase tracking-[0.2em] text-copper mb-2">
                          {item.type}
                        </div>
                        <h3 className="font-display text-xl font-medium leading-tight mb-2">
                          {item.title}
                        </h3>
                        <p className="text-sm text-bone/60 mb-3">{item.meta}</p>
                        <div className="flex items-center gap-2 text-xs text-bone/50">
                          <MapPin className="w-3 h-3" />
                          {t('explore.contributedBy', { buon: item.keeperBuon })}
                        </div>
                      </article>
                    ))}
                  </div>
                ))}
            </>
          )}
        </section>

        {/* ── LANGUAGE ──────────────────────────────── */}
        <section className="bg-bone text-ink">
          <div className="px-8 lg:px-12 xl:px-16 py-24 grid md:grid-cols-12 gap-12 items-start">
            <div className="md:col-span-6 order-2 md:order-1 space-y-3">
              {ethnicity.phrases.length === 0 ? (
                // Lô Lô. The research report has no greetings for them, and
                // inventing one for a language this endangered would be
                // worse than the gap.
                <div className="border border-dashed border-ink/25 px-6 py-10 text-center">
                  <p className="font-display text-xl mb-2 text-deep">
                    {t('explore.phrasesMissingTitle')}
                  </p>
                  <p className="text-sm text-ink/55 leading-relaxed">
                    {t('explore.phrasesMissingBody', { name: ethnicity.name[lang] })}
                  </p>
                </div>
              ) : (
                ethnicity.phrases.map((p) => (
                  <div key={p.native} className="border-b border-ink/10 pb-4">
                    <div className="flex items-baseline gap-6">
                      <div className="font-display text-2xl italic text-kteh w-40 shrink-0">
                        {p.native}
                      </div>
                      <div className="flex-1">
                        <div className="text-base">{lang === 'vi' ? p.vi : p.en}</div>
                        <div className="text-xs text-ink/55 mt-1">{p.note[lang]}</div>
                      </div>
                    </div>
                    {/* The rule that comes with the words. Set apart
                        because getting these wrong is the difference
                        between a greeting and an offence. */}
                    {p.etiquette && (
                      <p className="mt-2 ml-0 md:ml-[11.5rem] text-xs text-deep bg-kteh/5 border-l-2 border-kteh/40 pl-3 py-2 leading-relaxed">
                        {p.etiquette[lang]}
                      </p>
                    )}
                  </div>
                ))
              )}

              {/* Groups the report covers in language only. Shown once,
                  under Ê Đê, rather than repeated on all five tabs. */}
              {slug === 'ede' && (
                <div className="pt-8">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-ink/40 mb-4">
                    {t('explore.additionalPhrasesLabel')}
                  </div>
                  {ADDITIONAL_PHRASES.map((p) => (
                    <div
                      key={p.native}
                      className="flex items-baseline gap-6 border-b border-ink/10 pb-4 mb-3"
                    >
                      <div className="w-40 shrink-0">
                        <div className="font-display text-lg italic text-kteh/80">{p.native}</div>
                        <div className="text-[10px] uppercase tracking-wider text-ink/40 mt-1">
                          {p.people[lang]}
                          {p.region ? ` · ${p.region[lang]}` : ''}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm">{lang === 'vi' ? p.vi : p.en}</div>
                        <div className="text-xs text-ink/55 mt-1">{p.note[lang]}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-6 order-1 md:order-2">
              <div className="text-xs uppercase tracking-[0.25em] text-kteh mb-6">
                {t('explore.phrasesEyebrow')}
              </div>
              <h2 className="font-display section-title font-medium leading-[1.1] tracking-tight text-deep mb-8">
                {t('explore.phrasesHeading', { count: ethnicity.phrases.length })}
              </h2>
              <p className="text-lg text-ink/70 leading-relaxed mb-6">
                {t('explore.phrasesBody')}
              </p>
              <p className="text-sm text-ink/55 leading-relaxed flex items-start gap-2">
                <Languages className="w-4 h-4 shrink-0 mt-0.5" />
                {t('explore.phrasesScope')}
              </p>
              <p className="text-sm text-ink/45 leading-relaxed flex items-start gap-2 mt-3">
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
            <p className="text-bone/70">{t('explore.handoffBody')}</p>
          </div>
          <a
            href="#travel"
            className="group inline-flex items-center gap-3 bg-kteh hover:bg-kteh-hover px-8 py-4 transition"
          >
            {t('explore.handoffCta')}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </a>
        </section>
      </div>
    </div>
  );
}
