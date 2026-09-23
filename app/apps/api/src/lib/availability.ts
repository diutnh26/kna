import type { Prisma } from "@prisma/client";

/**
 * Availability: one AvailabilitySlot per open day of a listing, opened by its
 * provider. `capacity` and `booked` count rooms (per-night stays) or seats
 * (per-person experiences).
 *
 * Claiming is one conditional UPDATE per day:
 *
 *   UPDATE "AvailabilitySlot" SET booked = booked + n
 *   WHERE listingId = … AND date = … AND booked + n <= capacity
 *
 * Postgres locks the row for the UPDATE, and under READ COMMITTED a second
 * transaction waiting on that row re-checks the WHERE against the committed
 * value — so two guests racing for the last room cannot both get it. Days
 * are claimed in ascending order, so concurrent multi-night bookings take
 * their locks in the same order and cannot deadlock. A day that cannot be
 * claimed throws, and the whole booking transaction rolls back. The CHECK
 * constraint (0 <= booked <= capacity) is the last line behind all of it.
 */

export const DAY_MS = 86_400_000;

/** UTC midnight of a YYYY-MM-DD date — how slot and booking dates are stored. */
export function dateOnly(ymd: string) {
  return new Date(`${ymd}T00:00:00Z`);
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Days a booking holds: each night of a stay, or the one day of an experience. */
export function daysHeld(unit: string, nights: number) {
  return unit === "per night" ? nights : 1;
}

/**
 * The moment payment opens on-chain: 00:00 on the check-out date in Vietnam
 * (UTC+7), as a unix timestamp. Stored dates are UTC midnights.
 */
export function vnStartOfDayUnix(dateUtcMidnight: Date) {
  return Math.floor((dateUtcMidnight.getTime() - 7 * 3_600_000) / 1000);
}

export class AvailabilityError extends Error {
  constructor(
    public readonly code: "NO_SLOT" | "NO_CAPACITY",
    public readonly date: Date
  ) {
    super(code);
  }
}

export async function claimDays(
  tx: Prisma.TransactionClient,
  listingId: string,
  firstDay: Date,
  days: number,
  units: number
) {
  for (let i = 0; i < days; i++) {
    const date = addDays(firstDay, i);
    const claimed = await tx.$executeRaw`
      UPDATE "AvailabilitySlot"
      SET "booked" = "booked" + ${units}
      WHERE "listingId" = ${listingId} AND "date" = ${date} AND "booked" + ${units} <= "capacity"`;
    if (claimed === 0) {
      const slot = await tx.availabilitySlot.findUnique({
        where: { listingId_date: { listingId, date } },
      });
      throw new AvailabilityError(slot ? "NO_CAPACITY" : "NO_SLOT", date);
    }
  }
}

export async function releaseDays(
  tx: Prisma.TransactionClient,
  listingId: string,
  firstDay: Date,
  days: number,
  units: number
) {
  for (let i = 0; i < days; i++) {
    await tx.$executeRaw`
      UPDATE "AvailabilitySlot"
      SET "booked" = GREATEST("booked" - ${units}, 0)
      WHERE "listingId" = ${listingId} AND "date" = ${addDays(firstDay, i)}`;
  }
}
