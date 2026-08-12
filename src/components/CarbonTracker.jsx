import React, { useState, useMemo } from 'react';
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
import ImageSlot from './ImageSlot';

/* ── Emission factors ─────────────────────────────
   Round trip, kg CO₂e per person. Indicative figures
   for the prototype; replace with a verified dataset
   before publication.
   ─────────────────────────────────────────────── */

const ORIGINS = [
  { id: 'hcmc', label: 'Ho Chi Minh City', flight: 150, coach: 45, car: 95 },
  { id: 'hanoi', label: 'Hanoi', flight: 290, coach: 130, car: 210 },
  { id: 'danang', label: 'Đà Nẵng', flight: 130, coach: 60, car: 90 },
  { id: 'asia', label: 'Elsewhere in Asia', flight: 620, coach: null, car: null },
  { id: 'europe', label: 'Europe', flight: 2400, coach: null, car: null },
];

const MODES = [
  { id: 'flight', label: 'Flight', icon: Plane },
  { id: 'coach', label: 'Coach', icon: Bus },
  { id: 'car', label: 'Car', icon: Car },
];

const PER_NIGHT = 4; // homestay, no air conditioning
const PER_DAY_LOCAL = 3; // ground travel between buôn

const PROJECTS = [
  {
    id: 'yokdon',
    name: 'Yok Đôn buffer replanting',
    led: 'Buôn Đôn households',
    rate: 1100,
    unit: 'native saplings, tended for three years',
    body:
      'Degraded buffer land on the park edge, replanted with dipterocarp and tended by the households that farm beside it. Survival is counted annually, not at planting.',
    joinable: true,
  },
  {
    id: 'lak',
    name: 'Lắk Lake watershed planting',
    led: 'Buôn Trấp households',
    rate: 950,
    unit: 'bamboo and hardwood along the shoreline',
    body:
      'Shoreline planting to slow erosion into the lake. Run in the wet season, when saplings take without irrigation.',
    joinable: true,
  },
  {
    id: 'corridor',
    name: 'Elephant corridor upkeep',
    led: 'Buôn Đôn conservation group',
    rate: 1350,
    unit: 'habitat clearing and fodder planting',
    body:
      'Supports the shift away from elephant riding by funding habitat and fodder for observation-based tourism instead.',
    joinable: false,
  },
];

const vnd = (n) => Math.round(n).toLocaleString('vi-VN') + ' ₫';

export default function CarbonTracker() {
  const [origin, setOrigin] = useState('hcmc');
  const [mode, setMode] = useState('flight');
  const [nights, setNights] = useState(3);
  const [project, setProject] = useState('yokdon');

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
  const cost = breakdown.total * selected.rate;

  const bar = (value) => `${(value / breakdown.total) * 100}%`;

  return (
    <div className="min-h-screen bg-[#1A1614] text-[#F5EDDD] font-body antialiased">
      <Navbar active="Impact" theme="dark" />

      {/* ── OPENING ───────────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-20 md:py-24 grid md:grid-cols-12 gap-12 items-end">
        <div className="md:col-span-7">
          <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-[#B87333] mb-8">
            <span className="h-px w-12 bg-[#B87333]" />
            <span>Carbon tracker</span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-medium leading-[1.05] tracking-tight mb-8">
            Getting here has a cost. Here is the number.
          </h1>
          <p className="text-lg text-[#F5EDDD]/70 max-w-2xl leading-relaxed">
            Most of a trip&rsquo;s footprint is the journey, not the stay. The tracker shows the
            split, and offset contributions fund conservation work that Ê Đê communities choose,
            run, and measure themselves.
          </p>
        </div>

        <div className="md:col-span-5">
          <div className="border border-[#F5EDDD]/15 p-6 space-y-4">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[#B87333]">
              <Users className="w-4 h-4" />
              Community-led, not algorithm-led
            </div>
            <p className="text-sm text-[#F5EDDD]/70 leading-relaxed">
              Projects are identified by the buôn, approved by the Community Governance Committee,
              and counted on the ground each year. KNĂ does not generate offset schemes or buy
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
                Travelling from
              </label>
              <select
                id="origin"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="w-full bg-[#1A1614] border border-[#F5EDDD]/25 px-4 py-3 text-sm focus:outline-none focus:border-[#F5EDDD]/60"
              >
                {ORIGINS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs uppercase tracking-[0.2em] text-[#B87333] mb-4">
                How you arrive
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
                      {m.label}
                    </button>
                  );
                })}
              </div>
              {availableModes.length < MODES.length && (
                <p className="text-[11px] text-[#F5EDDD]/40 mt-3">
                  Overland options are not offered for this origin.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="nights" className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[#B87333] mb-4">
                <span>Nights in the buôn</span>
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
              Estimated footprint
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
                { c: 'bg-[#C8302E]', k: 'Getting to Đắk Lắk', v: breakdown.travel, i: MODES.find((m) => m.id === activeMode).icon },
                { c: 'bg-[#B87333]', k: `Staying ${nights} ${nights === 1 ? 'night' : 'nights'}`, v: breakdown.stay, i: Moon },
                { c: 'bg-[#E8A33D]', k: 'Moving between buôn', v: breakdown.local, i: Car },
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
                An estimate, not a measurement. Figures are indicative and will be replaced with a
                verified dataset before the platform goes live.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── OFFSET PROJECTS ───────────────────────── */}
      <section className="bg-[#F5EDDD] text-[#1A1614]">
        <div className="px-8 lg:px-12 xl:px-16 py-24">
          <div className="max-w-2xl mb-14">
            <div className="text-xs uppercase tracking-[0.25em] text-[#C8302E] mb-6">
              Where an offset goes
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight text-[#6B1A1A] mb-6">
              Three projects, all within an hour of where you will be staying.
            </h2>
            <p className="text-lg text-[#1A1614]/70 leading-relaxed">
              Choose one and the contribution is routed to that project&rsquo;s account, not to a
              general fund. On two of the three you can join the work yourself at the end of your
              stay.
            </p>
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
                          Join in
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
                Your contribution
              </div>
              <p className="text-lg leading-relaxed text-[#F5EDDD]/80">
                Offsetting {breakdown.total.toLocaleString('vi-VN')} kg through{' '}
                <span className="text-[#E8A33D]">{selected.name}</span>, led by {selected.led}.
                {selected.joinable
                  ? ' You are invited to plant on the final day of your stay.'
                  : ' This project is maintained year-round by the conservation group.'}
              </p>
            </div>

            <div className="md:col-span-5 flex flex-col items-start md:items-end gap-4">
              <div>
                <div className="font-display text-4xl md:text-5xl font-medium text-[#E8A33D] leading-none">
                  {vnd(cost)}
                </div>
                <div className="text-xs text-[#F5EDDD]/40 mt-2">
                  one contribution, per person
                </div>
              </div>
              <button className="group inline-flex items-center gap-3 bg-[#C8302E] hover:bg-[#A82826] px-8 py-4 transition">
                Add to my booking
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── VERIFICATION ──────────────────────────── */}
      <section className="px-8 lg:px-12 xl:px-16 py-24 grid md:grid-cols-12 gap-12 items-center">
        <div className="md:col-span-6">
          <div className="text-xs uppercase tracking-[0.25em] text-[#B87333] mb-6">
            Afterwards
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight mb-8">
            An offset you can follow, the same as any other payment.
          </h2>
          <p className="text-lg text-[#F5EDDD]/70 leading-relaxed mb-6">
            Offset contributions sit on the same public ledger as bookings and purchases. You can
            open the entry for yours and see when the project account received it.
          </p>
          <p className="text-sm text-[#F5EDDD]/55 leading-relaxed">
            Survival counts are published each year by the households running the site. A planting
            that fails is recorded as a failure.
          </p>
        </div>

        <div className="md:col-span-6">
          <div className="bg-[#F5EDDD]/[0.04] border border-[#F5EDDD]/10 p-8 font-mono text-sm">
            <div className="flex items-center justify-between gap-4 mb-8">
              <span className="text-[#F5EDDD]/40 text-xs uppercase tracking-wider">
                Ledger entry · sample
              </span>
              <ScanLine className="w-4 h-4 text-[#B87333]" />
            </div>
            <dl className="space-y-4 text-xs">
              {[
                ['Reference', 'KNA-OF-1182'],
                ['Contribution', '612 kg CO₂e'],
                ['Project', 'Yok Đôn buffer replanting'],
                ['Received by', 'Buôn Đôn households'],
                ['Planted', '18 Mar 2026 · 41 saplings'],
                ['Year 1 survival', '38 of 41'],
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
            Who decides which projects get funded?
          </h2>
          <p className="text-[#F5EDDD]/70">
            The Community Governance Committee. Their minutes, decisions, and fund allocations are
            published in the community space.
          </p>
        </div>
        <a
          href="#community"
          className="group inline-flex items-center gap-3 bg-[#C8302E] hover:bg-[#A82826] px-8 py-4 transition"
        >
          See the community space
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
        </a>
      </section>
    </div>
  );
}
