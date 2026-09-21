/**
 * Server-authoritative carbon factors for KNĂ offsets.
 * Must stay in step with apps/web/src/components/CarbonTracker.jsx ORIGINS /
 * PER_NIGHT / PER_DAY_LOCAL — the browser may preview; the API stores.
 */

export const ORIGIN_FACTORS = {
  hcmc: { flight: 150, coach: 45, car: 95 },
  hanoi: { flight: 290, coach: 130, car: 210 },
  danang: { flight: 130, coach: 60, car: 90 },
  asia: { flight: 620, coach: null, car: null },
  europe: { flight: 2400, coach: null, car: null },
} as const;

export type CarbonOrigin = keyof typeof ORIGIN_FACTORS;
export type TravelMode = "flight" | "coach" | "car";

export const PER_NIGHT_KG = 4;
export const PER_DAY_LOCAL_KG = 3;

/**
 * Round-trip kg CO₂e for the stay. Travel factor is per person; stay and
 * local ground travel scale with nights × guests.
 */
export function computeKgCo2e(opts: {
  origin: CarbonOrigin;
  travelMode: TravelMode;
  nights: number;
  guests: number;
}): number {
  const factors = ORIGIN_FACTORS[opts.origin];
  const travelPerPerson = factors[opts.travelMode];
  if (travelPerPerson == null) {
    throw new Error(`Travel mode ${opts.travelMode} is not available for origin ${opts.origin}`);
  }
  const nights = Math.max(1, Math.floor(opts.nights));
  const guests = Math.max(1, Math.floor(opts.guests));
  const travel = travelPerPerson * guests;
  const stay = nights * PER_NIGHT_KG * guests;
  const local = nights * PER_DAY_LOCAL_KG * guests;
  return travel + stay + local;
}
