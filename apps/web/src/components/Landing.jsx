import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Coins, Eye, Mountain, Users } from 'lucide-react';
import Navbar from './Navbar';
import { api } from '../lib/api';
import longhouseImg from '../assets/longhouse.png';
import cultureImg from '../assets/ede-culture.jpg';

// Icon + the fixed Ê Đê gloss word shown next to each pillar's translated
// title — these two are brand elements, not locale strings, so they don't
// come from the translation files and don't change with the EN/VI toggle.
const PILLAR_ICONS = [
  { icon: Coins, vn: 'Trao quyền' },
  { icon: Eye, vn: 'Bảo tồn' },
  { icon: Mountain, vn: 'Gìn giữ' },
  { icon: Users, vn: 'Cộng đồng' },
];

const CULTURE_MARKS = ['①', '②', '③'];

const FOOTER_HREFS = [
  ['#explore', '#travel', '#marketplace', '#community'],
  ['#community', '#community', '#impact', '#explore'],
];

const hhmm = (iso) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const vnd = (n) => n.toLocaleString('vi-VN') + ' ₫';

export default function Landing() {
  const { t } = useTranslation();
  const pillars = t('landing.pillars.items', { returnObjects: true });
  const culture = t('landing.culture.items', { returnObjects: true });
  const statLabels = t('landing.community.stats', { returnObjects: true });
  const footerColumns = t('landing.footer.columns', { returnObjects: true });

  const [ledger, setLedger] = useState([]);
  const [communityStats, setCommunityStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.ledger(4), api.communityStats()])
      .then(([ledgerData, statsData]) => {
        if (cancelled) return;
        setLedger(ledgerData);
        setCommunityStats(statsData);
      })
      .catch(() => {
        // The ledger panel is illustrative on the landing page; if the API
        // is unreachable the section renders its empty state rather than
        // blocking the whole marketing page behind an error.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The first two figures are policy, not measurements: 100% is the review
  // rule, 3–8% is the published commission band. Only the third is counted.
  const statsFigures = [
    '100%',
    '3 to 8%',
    communityStats ? `${communityStats.verifiedProviders}` : '—',
  ];

  return (
    <div className="min-h-screen bg-[#1A1614] text-[#F5EDDD] font-body antialiased">
      <Navbar active="" theme="dark" />

      {/* ── HERO ──────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#F5EDDD]">
        <div className="px-8 lg:px-12 xl:px-16 py-16 md:py-24 grid md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-6">
            <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-[#B87333] mb-10">
              <span className="h-px w-12 bg-[#B87333]" />
              <span>{t('landing.hero.eyebrow')}</span>
            </div>
            <h1 className="font-display page-title font-medium leading-[1.05] tracking-tight mb-10 text-[#1A1614]">
              {t('landing.hero.titleLine1')}{' '}
              <span className="text-[#C8302E]">{t('landing.hero.titleEm')}</span>{' '}
              {t('landing.hero.titleRest')}
            </h1>
            <p className="text-lg text-[#1A1614]/70 max-w-2xl mb-10 leading-relaxed">
              {t('landing.hero.body')}
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="#travel"
                className="group bg-[#C8302E] hover:bg-[#A82826] text-[#F5EDDD] px-8 py-4 inline-flex items-center gap-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1A1614]"
              >
                {t('landing.hero.ctaPrimary')}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </a>
              <a
                href="#community"
                className="border border-[#1A1614]/30 hover:border-[#1A1614]/70 text-[#1A1614] px-8 py-4 inline-flex items-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1A1614]"
              >
                {t('landing.hero.ctaSecondary')}
              </a>
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
              {t('landing.pillars.eyebrow')}
            </div>
            <h2 className="font-display page-title font-medium leading-[1.05] tracking-tight text-white">
              {t('landing.pillars.headingLine1')}
              <span> {t('landing.pillars.headingEm')}</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-[#F5EDDD]/10">
            {PILLAR_ICONS.map((p, i) => (
              <div
                key={p.vn}
                className="bg-[#1A1614] p-8 flex flex-col min-h-[320px] items-start text-left"
              >
                <p.icon className="w-5 h-5 text-[#B87333] mb-10" />
                <div className="font-display text-lg text-[#B87333] mb-2">{p.vn}</div>
                <h3 className="font-display text-xl font-medium mb-4 leading-tight">
                  {pillars[i]?.title}
                </h3>
                <p className="text-sm text-[#F5EDDD]/60 leading-relaxed">{pillars[i]?.body}</p>
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
              {t('landing.culture.eyebrow')}
            </div>
            <h2 className="font-display page-title font-medium leading-[1.05] tracking-tight mb-8 text-[#C8302E]">
              {t('landing.culture.headingLine1')}
            </h2>
            <p className="text-lg leading-relaxed text-[#1A1614]/80 mb-10">
              {t('landing.culture.body')}
            </p>

            <div className="space-y-6 mb-10">
              {CULTURE_MARKS.map((mark, i) => (
                <div
                  key={mark}
                  className={`flex items-start gap-5 ${
                    i < CULTURE_MARKS.length - 1 ? 'border-b border-[#1A1614]/10 pb-6' : 'pb-2'
                  }`}
                >
                  <span className="text-[#1A1614] text-xl font-medium w-6 shrink-0 mt-0.5">
                    {mark}
                  </span>
                  <div>
                    <div className="font-display text-base font-medium mb-2 text-[#1A1614]">
                      {culture[i]?.title}
                    </div>
                    <p className="text-sm text-[#1A1614]/60 leading-relaxed">{culture[i]?.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <a
              href="#explore"
              className="group inline-flex items-center gap-2 bg-[#1A1614] text-[#F5EDDD] text-sm px-4 py-3 transition hover:bg-black self-start"
            >
              {t('landing.culture.cta')}
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
              {t('landing.transparency.eyebrow')}
            </div>
            <h2 className="font-display page-title font-medium leading-[1.05] tracking-tight mb-8">
              {t('landing.transparency.heading')}
            </h2>
            <p className="text-lg leading-relaxed text-[#F5EDDD]/90 mb-8">
              {t('landing.transparency.body')}
            </p>
          </div>

          <div className="md:col-span-6 flex items-center">
            <div className="w-full bg-[#1A1614] p-8 font-mono text-sm">
              <div className="text-[#F5EDDD]/40 text-xs uppercase tracking-wider mb-6">
                {t('landing.transparency.ledgerLabel')}
              </div>
              <div className="space-y-4">
                {ledger.length === 0 ? (
                  <p className="text-[#F5EDDD]/40 text-xs">
                    {t('landing.transparency.ledgerEmpty')}
                  </p>
                ) : (
                  ledger.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-4 text-xs border-b border-[#F5EDDD]/10 pb-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-[#B87333] shrink-0">{hhmm(tx.createdAt)}</span>
                        <span className="text-[#F5EDDD]/50 shrink-0">{tx.fromLabel}</span>
                        <span className="text-[#F5EDDD]/30 shrink-0">→</span>
                        <span className="truncate">{tx.toLabel}</span>
                      </div>
                      <span className="text-[#E8A33D] shrink-0">{vnd(tx.totalVnd)}</span>
                    </div>
                  ))
                )}
              </div>
              {communityStats && communityStats.ledgerEntriesToday > ledger.length && (
                <div className="text-[#F5EDDD]/40 text-xs pt-4">
                  {t('landing.transparency.ledgerMore', {
                    count: communityStats.ledgerEntriesToday - ledger.length,
                  })}
                </div>
              )}
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
                {t('landing.community.eyebrow')}
              </div>
              <h2 className="font-display page-title font-medium leading-[1.05] tracking-tight mb-8 text-[#6B1A1A]">
                {t('landing.community.headingLine1')}
                <br />
                <span>{t('landing.community.headingEm')}</span>{' '}
                {t('landing.community.headingRest')}
              </h2>
              <p className="text-lg leading-relaxed text-[#1A1614]/70">
                {t('landing.community.body')}
              </p>
            </div>

            <div className="md:col-span-5">
              <div className="border-l-4 border-[#C8302E] pl-8 py-4 space-y-8">
                {statsFigures.map((figure, i) => (
                  <div key={statLabels[i]?.label ?? i}>
                    <div className="font-display text-5xl font-medium text-[#C8302E] mb-1">
                      {figure}
                    </div>
                    <p className="text-sm text-[#1A1614]/70">{statLabels[i]?.label}</p>
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
            {t('landing.invitation.eyebrow')}
          </div>
          <h2 className="font-display text-5xl md:text-8xl font-medium leading-[0.95] tracking-tight mb-10 max-w-4xl mx-auto text-white">
            {t('landing.invitation.headingLine1')}
            <br />
            <span className="italic text-[#E8A33D]">{t('landing.invitation.headingEm')}</span>
          </h2>
          <p className="text-lg text-[#F5EDDD]/70 max-w-3xl mb-12 mx-auto">
            {t('landing.invitation.body')}
          </p>
          <a
            href="#travel"
            className="group bg-[#C8302E] hover:bg-[#A82826] text-[#F5EDDD] px-10 py-5 inline-flex items-center gap-3 transition text-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1614] focus-visible:ring-[#F5EDDD]"
          >
            {t('landing.invitation.cta')}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
          </a>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────── */}
      <footer className="border-t border-[#F5EDDD]/10 bg-[#1A1614] text-[#F5EDDD]/60">
        <div className="px-8 lg:px-12 xl:px-16 py-16 grid grid-cols-2 md:grid-cols-[1.8fr_0.6fr_0.6fr_1.5fr] gap-12 text-left items-start">
          <div>
            <div className="font-display text-2xl text-[#F5EDDD] mb-3">KNĂ</div>
            <p className="text-sm leading-relaxed">{t('landing.footer.tagline')}</p>
          </div>

          {footerColumns.map((col, colIndex) => (
            <div key={col.heading}>
              <div className="text-xs uppercase tracking-[0.2em] text-[#F5EDDD] mb-4">
                {col.heading}
              </div>
              <ul className="space-y-2 text-sm">
                {col.items.map((item, itemIndex) => (
                  <li key={item}>
                    <a
                      href={FOOTER_HREFS[colIndex][itemIndex]}
                      className="hover:text-[#F5EDDD] transition"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#F5EDDD] mb-4">
              {t('landing.footer.stayInTouch')}
            </div>
            <p className="text-sm mb-4 leading-relaxed">{t('landing.footer.newsletterBody')}</p>
            <a
              href="#community"
              className="inline-flex items-center gap-2 text-sm text-[#E8A33D] underline underline-offset-4 hover:text-[#F5EDDD] transition"
            >
              {t('landing.footer.stayInTouchCta')}
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="border-t border-[#F5EDDD]/10">
          <div className="px-8 lg:px-12 xl:px-16 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-[#F5EDDD]/40">
            <div>{t('landing.footer.copyright')}</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
