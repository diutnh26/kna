import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Plane,
  Bus,
  Car,
  Moon,
  Sprout,
  ScanLine,
  Users,
  Info,
} from 'lucide-react';
import Navbar from './Navbar';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../context/useAuth';
import ImageSlot from './ImageSlot';

/* ── Emission factors ─────────────────────────────
   Round trip, kg CO₂e per person. Indicative figures
   for the prototype; replace with a verified dataset
   before publication.
   ─────────────────────────────────────────────── */

// The factors are data and stay here; only the label a visitor reads is
// translated, keyed by id so the two cannot drift apart.
const ORIGINS = [
  { id: 'hcmc', labelKey: 'carbon.originHcmc', flight: 150, coach: 45, car: 95 },
  { id: 'hanoi', labelKey: 'carbon.originHanoi', flight: 290, coach: 130, car: 210 },
  { id: 'danang', labelKey: 'carbon.originDanang', flight: 130, coach: 60, car: 90 },
  { id: 'asia', labelKey: 'carbon.originAsia', flight: 620, coach: null, car: null },
  { id: 'europe', labelKey: 'carbon.originEurope', flight: 2400, coach: null, car: null },
];

const MODES = [
  { id: 'flight', labelKey: 'carbon.modeFlight', icon: Plane },
  { id: 'coach', labelKey: 'carbon.modeCoach', icon: Bus },
  { id: 'car', labelKey: 'carbon.modeCar', icon: Car },
];

const PER_NIGHT = 4; // homestay, no air conditioning
const PER_DAY_LOCAL = 3; // ground travel between buôn

const PROJECT_FACTS = {
  yokdon: { rate: 1100, joinable: true },
  lak: { rate: 950, joinable: true },
  corridor: { rate: 1350, joinable: false },
};

const vnd = (n) => Math.round(n).toLocaleString('vi-VN') + ' ₫';

/**
 * Kept in step with apps/api/src/routes/offsets.ts.
 *
 * The server is the authority on what anything costs — it recomputes this
 * from the origin id the client sends. This exists only so the figure the
 * guest reads before pressing the button is the figure they are charged.
 * A preview that disagreed with the receipt would be worse than no preview.
 */
const DONATION_SHARE_INTERNATIONAL = 0.35;
const INTERNATIONAL_ORIGINS = new Set(['asia', 'europe']);

function donationFor(project, kg, originId) {
  const full = kg * project.rate;
  // Only the two projects that run sessions carry the adjusted share; the
  // corridor is year-round and unchanged.
  const adjusted =
    project.joinable && INTERNATIONAL_ORIGINS.has(originId)
      ? full * DONATION_SHARE_INTERNATIONAL
      : full;
  return Math.round(adjusted);
}
const dmy = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function CarbonTracker() {
  const { t } = useTranslation();
  // Copy from the locale files, rates and joinability from PROJECT_FACTS.
  const PROJECTS = t('carbon.projects', { returnObjects: true }).map((p) => ({
    ...p,
    ...PROJECT_FACTS[p.id],
  }));
  const [origin, setOrigin] = useState('hcmc');
  const [mode, setMode] = useState('flight');
  const [nights, setNights] = useState(3);
  const [project, setProject] = useState('yokdon');

  // An offset is paid with a stay, so it hangs off a booking rather than
  // standing alone. The picker below only appears once there is a choice
  // to make.
  const { token, isAuthenticated, openAuthModal } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [bookingId, setBookingId] = useState('');
  // Named `contribution` rather than `mode`: this component already has a
  // `mode` for how the guest travels.
  const [contribution, setContribution] = useState('DONATE');
  const [attachState, setAttachState] = useState({ busy: false, message: '', error: '' });

  const loadBookings = useCallback(async () => {
    if (!isAuthenticated) return [];
    return api.offsetBookings(token);
  }, [isAuthenticated, token]);

  useEffect(() => {
    let cancelled = false;
    loadBookings()
      .then((rows) => {
        if (cancelled) return;
        setBookings(rows);
        // Preselect the soonest stay; the API already returns them in
        // arrival order, which is the one a guest is thinking about.
        setBookingId((current) => current || rows[0]?.id || '');
      })
      .catch(() => {
        if (!cancelled) setBookings([]);
      });
    return () => {
      cancelled = true;
    };
  }, [loadBookings]);

  const originData = ORIGINS.find((o) => o.id === origin);
  const availableModes = MODES.filter((m) => originData[m.id] !== null);

  // Keep the mode valid when origin changes.
  const activeMode = originData[mode] === null ? 'flight' : mode;

  const breakdown = useMemo(() => {
    const travel = originData[activeMode] ?? 0;
    const stay = nights * PER_NIGHT;
    const local = nights * PER_DAY_LOCAL;
    return { travel, stay, local, total: travel + stay + local };
  }, [originData, activeMode, nights]);

  const selected = PROJECTS.find((p) => p.id === project);
  const cost = donationFor(selected, breakdown.total, origin);
  const isInternational = INTERNATIONAL_ORIGINS.has(origin);

  const bar = (value) => `${(value / breakdown.total) * 100}%`;

  const chosenBooking = bookings.find((b) => b.id === bookingId) ?? null;
  const existingOffset = chosenBooking?.offset ?? null;

  // Whether a session falls inside this stay is decided by the server and
  // read here. Recomputing it in the browser would risk offering a choice
  // the API then refuses.
  const activity = chosenBooking?.activity?.[project] ?? { current: null, next: null, eligible: false };

  // A session runs over several days, so it reads as a range.
  const range = (w) =>
    w ? t('carbon.sessionRange', { start: dmy(w.startDate), end: dmy(w.endDate) }) : '';
  // Joining is offered first on every project that runs sessions, and is
  // simply unavailable when no session falls inside the stay. It used to
  // be replaced in that case by "leave your place for a later visitor",
  // which took the first slot while being the absence of a contribution
  // rather than one of them.
  const canJoin = selected.joinable && activity.eligible;
  const canBookNext = selected.joinable && Boolean(activity.next);

  // Derived rather than synced. Switching project or booking can make the
  // held choice illegal, and computing the effective one each render keeps
  // it legal without an effect writing state back into itself.
  const chosen =
    (contribution === 'IN_PERSON' && !canJoin) || (contribution === 'NEXT_SESSION' && !canBookNext)
      ? 'DONATE'
      : contribution;

  async function attachOffset() {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    if (!bookingId) return;

    setAttachState({ busy: true, message: '', error: '' });
    try {
      await api.attachOffset(
        {
          bookingId,
          projectId: project,
          kgCo2e: breakdown.total,
          mode: chosen,
          // The server classifies this as domestic or not; it never accepts
          // a "this is international" flag from the browser.
          origin,
        },
        token
      );
      setBookings(await loadBookings());
      setAttachState({ busy: false, message: t('carbon.attached'), error: '' });
    } catch (err) {
      setAttachState({
        busy: false,
        message: '',
        error: err instanceof ApiError ? err.message : t('carbon.attachError'),
      });
    }
  }

  async function removeOffset() {
    setAttachState({ busy: true, message: '', error: '' });
    try {
      await api.removeOffset(bookingId, token);
      setBookings(await loadBookings());
      setAttachState({ busy: false, message: t('carbon.removed'), error: '' });
    } catch (err) {
      setAttachState({
        busy: false,
        message: '',
        error: err instanceof ApiError ? err.message : t('carbon.attachError'),
      });
    }
  }

  return (
    <div className="min-h-screen bg-[#1A1614] text-[#F5EDDD] font-body antialiased">
      <Navbar active="impact" theme="dark" />

      {/* ── OPENING ───────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-20 md:py-24 grid md:grid-cols-12 gap-12 items-end">
        <div className="md:col-span-7">
          <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-[#B87333] mb-8">
            <span className="h-px w-12 bg-[#B87333]" />
            <span>{t('carbon.eyebrow')}</span>
          </div>
          <h1 className="font-display page-title-sm font-medium leading-[1.05] tracking-tight mb-8">
            {t('carbon.title')}
          </h1>
          <p className="text-lg text-[#F5EDDD]/70 max-w-2xl leading-relaxed">
            {t('carbon.intro')}
            run, and measure themselves.
          </p>
        </div>

        <div className="md:col-span-5">
          <div className="border border-[#F5EDDD]/15 p-6 space-y-4">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[#B87333]">
              <Users className="w-4 h-4" />
              {t('carbon.communityLedTitle')}
            </div>
            <p className="text-sm text-[#F5EDDD]/70 leading-relaxed">
              {t('carbon.communityLedBody')}
              credits on your behalf.
            </p>
          </div>
        </div>
      </section>

      {/* ── CALCULATOR ────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 pb-24">
        <div className="grid lg:grid-cols-12 gap-8">

          {/* Inputs */}
          <div className="lg:col-span-5 border border-[#F5EDDD]/15 p-8 space-y-10">
            <div>
              <label htmlFor="origin" className="block text-xs uppercase tracking-[0.2em] text-[#B87333] mb-4">
                {t('carbon.travellingFrom')}
              </label>
              <select
                id="origin"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="w-full bg-[#1A1614] border border-[#F5EDDD]/25 px-4 py-3 text-sm focus:outline-none focus:border-[#F5EDDD]/60"
              >
                {ORIGINS.map((o) => (
                  <option key={o.id} value={o.id}>{t(o.labelKey)}</option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs uppercase tracking-[0.2em] text-[#B87333] mb-4">
                {t('carbon.howYouArrive')}
              </span>
              <div className="grid grid-cols-3 gap-2">
                {MODES.map((m) => {
                  const disabled = originData[m.id] === null;
                  const active = activeMode === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => !disabled && setMode(m.id)}
                      disabled={disabled}
                      className={`flex flex-col items-center gap-2 py-4 border text-xs uppercase tracking-wider transition ${
                        active
                          ? 'bg-[#F5EDDD] text-[#1A1614] border-[#F5EDDD]'
                          : disabled
                          ? 'border-[#F5EDDD]/10 text-[#F5EDDD]/20 cursor-not-allowed'
                          : 'border-[#F5EDDD]/25 hover:border-[#F5EDDD]/60'
                      }`}
                    >
                      <m.icon className="w-4 h-4" />
                      {t(m.labelKey)}
                    </button>
                  );
                })}
              </div>
              {availableModes.length < MODES.length && (
                <p className="text-[11px] text-[#F5EDDD]/40 mt-3">
                  {t('carbon.noOverland')}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="nights" className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[#B87333] mb-4">
                <span>{t('carbon.nightsLabel')}</span>
                <span className="font-display text-2xl text-[#E8A33D] normal-case tracking-normal">
                  {nights}
                </span>
              </label>
              <input
                id="nights"
                type="range"
                min="1"
                max="14"
                value={nights}
                onChange={(e) => setNights(Number(e.target.value))}
                className="w-full accent-[#C8302E]"
              />
              <div className="flex justify-between text-[11px] text-[#F5EDDD]/35 mt-2">
                <span>1</span>
                <span>14</span>
              </div>
            </div>

            <p className="text-[11px] text-[#F5EDDD]/40 leading-relaxed border-t border-[#F5EDDD]/10 pt-5">
              Homestays are counted at {PER_NIGHT} kg per night, well below a hotel, because none of
              them run air conditioning. Local movement between buôn adds {PER_DAY_LOCAL} kg a day.
            </p>
          </div>

          {/* Result */}
          <div className="lg:col-span-7 border border-[#F5EDDD]/15 p-8 flex flex-col">
            <div className="text-xs uppercase tracking-[0.2em] text-[#F5EDDD]/40 mb-6">
              {t('carbon.estimatedFootprint')}
            </div>

            <div className="flex items-baseline gap-4 mb-2">
              <span className="font-display text-6xl md:text-7xl font-medium text-[#E8A33D] leading-none">
                {breakdown.total.toLocaleString('vi-VN')}
              </span>
              <span className="text-lg text-[#F5EDDD]/50">kg CO₂e</span>
            </div>
            <p className="text-sm text-[#F5EDDD]/50 mb-10">per person, return</p>

            {/* Proportional bar */}
            <div className="flex h-3 mb-8 overflow-hidden">
              <div className="bg-[#C8302E]" style={{ width: bar(breakdown.travel) }} />
              <div className="bg-[#B87333]" style={{ width: bar(breakdown.stay) }} />
              <div className="bg-[#E8A33D]" style={{ width: bar(breakdown.local) }} />
            </div>

            <dl className="space-y-5 mb-10">
              {[
                { c: 'bg-[#C8302E]', k: t('carbon.rowTravel'), v: breakdown.travel, i: MODES.find((m) => m.id === activeMode).icon },
                { c: 'bg-[#B87333]', k: t('carbon.rowStay', { count: nights }), v: breakdown.stay, i: Moon },
                { c: 'bg-[#E8A33D]', k: t('carbon.rowLocal'), v: breakdown.local, i: Car },
              ].map((row) => (
                <div key={row.k} className="flex items-center gap-4 border-b border-[#F5EDDD]/10 pb-4">
                  <span className={`w-2 h-2 ${row.c} shrink-0`} />
                  <row.i className="w-4 h-4 text-[#F5EDDD]/40 shrink-0" />
                  <dt className="text-sm flex-1">{row.k}</dt>
                  <dd className="font-mono text-sm text-[#F5EDDD]/70">
                    {row.v.toLocaleString('vi-VN')} kg
                  </dd>
                  <dd className="font-mono text-xs text-[#F5EDDD]/35 w-12 text-right">
                    {Math.round((row.v / breakdown.total) * 100)}%
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-auto flex items-start gap-3 text-xs text-[#F5EDDD]/45 leading-relaxed">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#B87333]" />
              <p>
                {t('carbon.estimateNote')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── OFFSET PROJECTS ───────────────────────── */}
      <section className="bg-[#F5EDDD] text-[#1A1614]">
        <div className="px-8 lg:px-12 xl:px-16 py-24">
          {/* Title left, prose right, filling the row. It was a max-w-2xl
              column, which wrapped the heading into several short lines and
              left the other half of the section empty. */}
          <div className="grid md:grid-cols-12 gap-8 md:gap-12 items-start mb-14">
            <div className="md:col-span-5">
              <div className="text-xs uppercase tracking-[0.25em] text-[#C8302E] mb-6">
                {t('carbon.projectsEyebrow')}
              </div>
              <h2 className="font-display page-title-sm font-medium leading-[1.1] tracking-tight text-[#6B1A1A]">
                {t('carbon.projectsHeading')}
              </h2>
            </div>
            <div className="md:col-span-7 md:pt-10">
              <p className="text-lg text-[#1A1614]/70 leading-relaxed">
                {t('carbon.projectsBody')}
              </p>
              {/* Said plainly here rather than only in the donation note: the
                  saplings are already paid for, and a visitor should know
                  that before deciding what to add. */}
              <p className="text-sm text-[#1A1614]/60 leading-relaxed mt-4">
                {t('carbon.communityFundAlreadyCovers')}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-14">
            {PROJECTS.map((p) => {
              const active = project === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setProject(p.id)}
                  className={`text-left border transition flex flex-col ${
                    active
                      ? 'border-[#C8302E] border-2 bg-[#1A1614] text-[#F5EDDD]'
                      : 'border-[#1A1614]/15 hover:border-[#1A1614]/40'
                  }`}
                >
                  <ImageSlot
                    src={p.image}
                    alt={p.alt}
                    position={p.position}
                    theme={active ? 'dark' : 'light'}
                    ratio="aspect-[3/2]"
                    label={`${p.name} — site photograph`}
                    className="border-0 border-b border-dashed"
                  />
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <span className={`text-[10px] uppercase tracking-[0.2em] ${active ? 'text-[#B87333]' : 'text-[#B87333]'}`}>
                        Led by {p.led}
                      </span>
                      {p.joinable && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#E8A33D]">
                          <Sprout className="w-3 h-3" />
                          {t('carbon.joinIn')}
                        </span>
                      )}
                    </div>
                    <h3 className="font-display text-xl font-medium leading-tight mb-3">
                      {p.name}
                    </h3>
                    <p className={`text-sm leading-relaxed mb-5 flex-1 ${active ? 'text-[#F5EDDD]/60' : 'text-[#1A1614]/65'}`}>
                      {p.body}
                    </p>
                    <div className={`text-xs pt-4 border-t ${active ? 'border-[#F5EDDD]/15 text-[#F5EDDD]/50' : 'border-[#1A1614]/10 text-[#1A1614]/50'}`}>
                      {vnd(p.rate)} per kg · {p.unit}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Summary */}
          <div className="bg-[#1A1614] text-[#F5EDDD] p-8 md:p-10 grid md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-7">
              <div className="text-xs uppercase tracking-[0.2em] text-[#B87333] mb-4">
                {t('carbon.yourContribution')}
              </div>
              <p className="text-lg leading-relaxed text-[#F5EDDD]/80">
                {t('carbon.offsetting', { kg: breakdown.total.toLocaleString('vi-VN') })}{' '}
                <span className="text-[#E8A33D]">{selected.name}</span>
                {t('carbon.ledBy', { led: selected.led })}
                {selected.joinable ? t('carbon.joinableYes') : t('carbon.joinableNo')}
              </p>

              {/* The figure belongs beside the sentence it is the figure
                  for, not across the card from it. The right column is the
                  controls. */}
              <div className="mt-8">
                <div className="font-display price-hero font-medium text-[#E8A33D] leading-none">
                  {chosen === 'DONATE' ? vnd(cost) : t('carbon.free')}
                </div>
                <div className="text-xs text-[#F5EDDD]/40 mt-2">
                  {chosen === 'DONATE'
                    ? t('carbon.perPerson')
                    : chosen === 'IN_PERSON'
                      ? range(activity.current)
                      : range(activity.next)}
                </div>
              </div>
            </div>

            <div className="md:col-span-5">
              <div className="w-full space-y-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#B87333]">
                  {t('carbon.attachEyebrow')}
                </div>

                {!isAuthenticated ? (
                  <>
                    <p className="text-sm text-[#F5EDDD]/60 leading-relaxed">
                      {t('carbon.signedOut')}
                    </p>
                    <button
                      onClick={openAuthModal}
                      className="w-full bg-[#C8302E] hover:bg-[#A82826] px-6 py-3 text-sm uppercase tracking-wider transition"
                    >
                      {t('carbon.signIn')}
                    </button>
                  </>
                ) : bookings.length === 0 ? (
                  <>
                    <p className="text-sm text-[#F5EDDD]/60 leading-relaxed">
                      <span className="text-[#F5EDDD]/80">{t('carbon.noBookings')}</span>{' '}
                      {t('carbon.noBookingsBody')}
                    </p>
                    <a
                      href="#travel"
                      className="inline-flex items-center gap-2 text-sm text-[#E8A33D] underline underline-offset-4"
                    >
                      {t('carbon.seeExperiences')}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </>
                ) : (
                  <>
                    {/* One booking needs no choosing; two or more do. */}
                    {bookings.length >= 2 ? (
                      <div>
                        <label
                          htmlFor="offset-booking"
                          className="block text-xs text-[#F5EDDD]/50 mb-2"
                        >
                          {t('carbon.chooseBooking')}
                        </label>
                        <select
                          id="offset-booking"
                          value={bookingId}
                          onChange={(e) => {
                            setBookingId(e.target.value);
                            setAttachState({ busy: false, message: '', error: '' });
                          }}
                          className="w-full bg-[#1A1614] border border-[#F5EDDD]/25 text-sm px-3 py-2.5 focus:outline-none focus:border-[#F5EDDD]/60"
                        >
                          {bookings.map((b) => (
                            <option key={b.id} value={b.id}>
                              {t('carbon.bookingOption', {
                                title: b.listingTitle,
                                date: dmy(b.checkIn),
                              })}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      chosenBooking && (
                        <p className="text-sm text-[#F5EDDD]/60 leading-relaxed">
                          {t('carbon.onlyBooking', {
                            title: chosenBooking.listingTitle,
                            date: dmy(chosenBooking.checkIn),
                          })}
                        </p>
                      )
                    )}

                    {selected.joinable ? (
                      <fieldset className="space-y-2">
                        <legend className="text-xs text-[#F5EDDD]/50 mb-2">
                          {t('carbon.howToTakePart')}
                        </legend>

                        {/* Always first, whether or not it can be taken.
                            Seeing what is on offer and why it is closed
                            reads better than never seeing it at all. */}
                        <label
                          className={`flex gap-3 border p-3 transition ${
                            !canJoin
                              ? 'border-[#F5EDDD]/10 opacity-45 cursor-not-allowed'
                              : chosen === 'IN_PERSON'
                                ? 'border-[#8FA37B] bg-[#8FA37B]/10 cursor-pointer'
                                : 'border-[#F5EDDD]/20 hover:border-[#F5EDDD]/40 cursor-pointer'
                          }`}
                        >
                          <input
                            type="radio"
                            name="contribution"
                            value="IN_PERSON"
                            checked={chosen === 'IN_PERSON'}
                            disabled={!canJoin}
                            onChange={() => setContribution('IN_PERSON')}
                            className="mt-1 accent-[#8FA37B] shrink-0"
                          />
                          <span>
                            <span className="flex items-baseline gap-2">
                              <span className="text-sm">{t('carbon.optionInPerson')}</span>
                              {canJoin && (
                                <span className="text-[10px] uppercase tracking-wider text-[#8FA37B]">
                                  {t('carbon.free')}
                                </span>
                              )}
                            </span>
                            <span className="block text-xs text-[#F5EDDD]/55 leading-snug mt-1">
                              {canJoin
                                ? t('carbon.optionInPersonBody', { range: range(activity.current) })
                                : activity.next
                                  ? t('carbon.optionInPersonUnavailable', {
                                      range: range(activity.next),
                                    })
                                  : t('carbon.optionInPersonNoSessions')}
                            </span>
                          </span>
                        </label>

                        {/* Missing every session is not the same as being
                            unable to help. A guest can commit to the next
                            one and come back for it. */}
                        {canBookNext && (
                          <label
                            className={`flex gap-3 border p-3 cursor-pointer transition ${
                              chosen === 'NEXT_SESSION'
                                ? 'border-[#8FA37B] bg-[#8FA37B]/10'
                                : 'border-[#F5EDDD]/20 hover:border-[#F5EDDD]/40'
                            }`}
                          >
                            <input
                              type="radio"
                              name="contribution"
                              value="NEXT_SESSION"
                              checked={chosen === 'NEXT_SESSION'}
                              onChange={() => setContribution('NEXT_SESSION')}
                              className="mt-1 accent-[#8FA37B] shrink-0"
                            />
                            <span>
                              <span className="flex items-baseline gap-2">
                                <span className="text-sm">{t('carbon.optionNextSession')}</span>
                                <span className="text-[10px] uppercase tracking-wider text-[#8FA37B]">
                                  {t('carbon.free')}
                                </span>
                              </span>
                              <span className="block text-xs text-[#F5EDDD]/55 leading-snug mt-1">
                                {t('carbon.optionNextSessionBody', { range: range(activity.next) })}
                              </span>
                            </span>
                          </label>
                        )}

                        <label
                          className={`flex gap-3 border p-3 cursor-pointer transition ${
                            chosen === 'DONATE'
                              ? 'border-[#E8A33D] bg-[#E8A33D]/10'
                              : 'border-[#F5EDDD]/20 hover:border-[#F5EDDD]/40'
                          }`}
                        >
                          <input
                            type="radio"
                            name="contribution"
                            value="DONATE"
                            checked={chosen === 'DONATE'}
                            onChange={() => setContribution('DONATE')}
                            className="mt-1 accent-[#E8A33D] shrink-0"
                          />
                          <span>
                            <span className="text-sm">{t('carbon.optionDonate')}</span>
                            <span className="block text-xs text-[#F5EDDD]/55 leading-snug mt-1">
                              {t('carbon.optionDonateBody', { amount: vnd(cost) })}
                            </span>
                            {isInternational && (
                              <span className="block text-[11px] text-[#B87333] leading-snug mt-1.5">
                                {t('carbon.internationalRateNote')}
                              </span>
                            )}
                          </span>
                        </label>
                      </fieldset>
                    ) : (
                      <p className="text-xs text-[#F5EDDD]/40 leading-snug">
                        {t('carbon.noSessions')}
                      </p>
                    )}

                    {existingOffset && (
                      <p className="text-xs text-[#B87333] leading-snug">
                        {t('carbon.replaceNote', {
                          project: PROJECTS.find((p) => p.id === existingOffset.projectId)?.name ?? '',
                        })}
                      </p>
                    )}

                    {/* Remove sits beside the action rather than under it:
                        it is the smaller of the two decisions and does not
                        need a line of its own. */}
                    {/* Spans the panel, like the option boxes above it —
                        a short button under full-width choices read as an
                        afterthought rather than the action they lead to. */}
                    <div className="flex items-center gap-3 w-full">
                      <button
                        onClick={attachOffset}
                        disabled={attachState.busy || !bookingId}
                        className="group flex-1 inline-flex items-center justify-center gap-2 bg-[#C8302E] hover:bg-[#A82826] disabled:opacity-50 px-4 py-2.5 text-xs uppercase tracking-wider transition"
                      >
                        {attachState.busy ? t('carbon.attaching') : t('carbon.attach')}
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                      </button>

                      {existingOffset && !attachState.busy && (
                        <button
                          onClick={removeOffset}
                          className="shrink-0 text-xs text-[#F5EDDD]/45 underline underline-offset-4 hover:text-[#F5EDDD]/70"
                        >
                          {t('carbon.remove')}
                        </button>
                      )}
                    </div>

                    {attachState.message && (
                      <p className="text-sm text-[#8FA37B]">
                        {attachState.message}{' '}
                        <span className="text-[#F5EDDD]/45">{t('carbon.pendingNote')}</span>
                      </p>
                    )}
                    {attachState.error && (
                      <p className="text-sm text-[#E8A33D]">{attachState.error}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── VERIFICATION ──────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-24 grid md:grid-cols-12 gap-12 items-center">
        <div className="md:col-span-6">
          <div className="text-xs uppercase tracking-[0.25em] text-[#B87333] mb-6">
            {t('carbon.afterwardsEyebrow')}
          </div>
          <h2 className="font-display section-title font-medium leading-[1.1] tracking-tight mb-8">
            {t('carbon.afterwardsHeading')}
          </h2>
          <p className="text-lg text-[#F5EDDD]/70 leading-relaxed mb-6">
            {t('carbon.afterwardsBody')}
          </p>
          <p className="text-sm text-[#F5EDDD]/55 leading-relaxed">
            {t('carbon.afterwardsNote')}
          </p>
        </div>

        <div className="md:col-span-6">
          <div className="bg-[#F5EDDD]/[0.04] border border-[#F5EDDD]/10 p-8 font-mono text-sm">
            <div className="flex items-center justify-between gap-4 mb-8">
              <span className="text-[#F5EDDD]/40 text-xs uppercase tracking-wider">
                {t('carbon.ledgerSample')}
              </span>
              <ScanLine className="w-4 h-4 text-[#B87333]" />
            </div>
            <dl className="space-y-4 text-xs">
              {[
                [t('carbon.ledgerReference'), 'KNA-OF-1182'],
                [
                  t('carbon.ledgerContribution'),
                  chosen === 'IN_PERSON'
                    ? t('carbon.ledgerInPersonContribution')
                    : isInternational && selected.joinable
                      ? t('carbon.ledgerDonateContribution')
                      : `${breakdown.total.toLocaleString('vi-VN')} kg CO₂e`,
                ],
                [t('carbon.ledgerProject'), PROJECTS[0].name],
                [t('carbon.ledgerReceivedBy'), PROJECTS[0].led],
                [t('carbon.ledgerPlanted'), t('carbon.ledgerPlantedValue')],
                [t('carbon.ledgerSurvival'), t('carbon.ledgerSurvivalValue')],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-6 border-b border-[#F5EDDD]/10 pb-3">
                  <dt className="text-[#F5EDDD]/45 shrink-0">{k}</dt>
                  <dd className="text-right">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-6 pt-1">
                <dt className="text-[#F5EDDD]/45 shrink-0">Status</dt>
                <dd className="text-[#E8A33D]">Verified on site</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <div className="h-3 textile" />

      {/* ── HANDOFF ───────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-20 flex flex-wrap items-center justify-between gap-8">
        <div className="max-w-xl">
          <h2 className="font-display text-3xl md:text-4xl font-medium leading-tight mb-3">
            {t('carbon.handoffHeading')}
          </h2>
          <p className="text-[#F5EDDD]/70">
            {t('carbon.handoffBody')}
          </p>
        </div>
        <a
          href="#community"
          className="group inline-flex items-center gap-3 bg-[#C8302E] hover:bg-[#A82826] px-8 py-4 transition"
        >
          {t('carbon.handoffCta')}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
        </a>
      </section>
    </div>
  );
}
