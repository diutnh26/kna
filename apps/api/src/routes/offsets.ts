import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

export const offsetsRouter = Router();

/**
 * Carbon offsets, attached to the booking they belong to.
 *
 * Every figure here is worked out on the server. The browser computes a
 * preview so the guest sees a number before they commit, exactly as the
 * booking screen does — but what is stored, and what reaches the public
 * ledger, is what this file decided. A client that could name its own
 * price could donate 1₫ and have the ledger say so.
 */

const MS_PER_DAY = 86_400_000;

/**
 * Two of the three projects run on a fortnightly cycle. A guest whose stay
 * meets a session can work it; a guest whose stay does not cannot, and
 * that is a fact about the calendar rather than about their willingness.
 *
 * The elephant corridor has no schedule at all: habitat and fodder are
 * maintained year-round rather than in sessions, so there is nothing to
 * turn up to. It keeps its original shape entirely.
 */
const PROJECTS = {
  yokdon: {
    ratePerKgVnd: 1100,
    joinable: true,
    activityAnchorDate: "2026-01-10",
    activityIntervalDays: 14,
  },
  lak: {
    ratePerKgVnd: 950,
    joinable: true,
    // Offset a week from Yok Đôn so the two do not fall on the same day.
    activityAnchorDate: "2026-01-17",
    activityIntervalDays: 14,
  },
  corridor: {
    ratePerKgVnd: 1350,
    joinable: false,
    activityAnchorDate: null,
    activityIntervalDays: null,
  },
} as const;

type ProjectId = keyof typeof PROJECTS;

/**
 * What a long-haul guest is asked for, as a share of the full rate.
 *
 * The full rate buys saplings and three years of tending. Most of that is
 * already funded by the Community Fund, which takes 3% of every booking —
 * so asking a guest who has already flown in to pay the whole cost again
 * charges twice for the same trees. This share covers the cost of running
 * the session rather than the planting itself.
 *
 * Domestic guests pay the full rate: their journey is a fraction of the
 * footprint, and the original figure was set with them in mind.
 */
const DONATION_SHARE_INTERNATIONAL = 0.35;

/**
 * Must stay in step with ORIGINS in apps/web/src/components/CarbonTracker.jsx.
 * Classified here rather than accepted as a boolean from the client: this
 * decides an amount of money, and the client is not the authority on money.
 */
const INTERNATIONAL_ORIGINS = new Set(["asia", "europe"]);

/** How each project appears on the public ledger. */
const PROJECT_LEDGER_LABEL: Record<ProjectId, string> = {
  yokdon: "Yok Đôn buffer replanting",
  lak: "Lắk Lake watershed planting",
  corridor: "Elephant corridor upkeep",
};

/** Midnight UTC for a date-only value, so arithmetic never drifts a day. */
function utcDay(value: Date | string): number {
  const d = typeof value === "string" ? new Date(`${value}T00:00:00Z`) : value;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * The first session on or after `fromDate`: the anchor plus whole multiples
 * of the interval. Returns null for a project that does not run sessions.
 */
export function getNextActivityDate(
  project: { activityAnchorDate: string | null; activityIntervalDays: number | null },
  fromDate: Date | string
): string | null {
  if (!project.activityAnchorDate || !project.activityIntervalDays) return null;

  const anchor = utcDay(project.activityAnchorDate);
  const from = utcDay(fromDate);
  if (from <= anchor) return isoDay(anchor);

  const elapsedDays = (from - anchor) / MS_PER_DAY;
  const periods = Math.ceil(elapsedDays / project.activityIntervalDays);
  return isoDay(anchor + periods * project.activityIntervalDays * MS_PER_DAY);
}

/** The last night of a stay: check-in plus one night fewer than booked. */
function lastNight(checkIn: Date, nights: number): number {
  return utcDay(checkIn) + (Math.max(1, nights) - 1) * MS_PER_DAY;
}

/**
 * Whether a session falls inside the stay, and which one.
 *
 * Measured from the check-in date rather than from today. A guest booking
 * three months out would otherwise always be told no: the next session
 * from today would fall long before they arrive, and "can I join?" is a
 * question about their stay, not about this week.
 */
function activityDuringStay(
  projectId: ProjectId,
  checkIn: Date,
  nights: number
): { nextActivityDate: string | null; eligible: boolean } {
  const project = PROJECTS[projectId];
  const nextActivityDate = getNextActivityDate(project, checkIn);
  if (!nextActivityDate) return { nextActivityDate: null, eligible: false };

  const eligible = utcDay(nextActivityDate) <= lastNight(checkIn, nights);
  return { nextActivityDate, eligible };
}

/** What the server charges, given the choice and where the guest came from. */
function amountFor(projectId: ProjectId, mode: Mode, kgCo2e: number, origin: string): number {
  // Turning up costs nothing.
  if (mode !== "DONATE") return 0;

  const full = kgCo2e * PROJECTS[projectId].ratePerKgVnd;
  const adjusted =
    PROJECTS[projectId].joinable && INTERNATIONAL_ORIGINS.has(origin)
      ? full * DONATION_SHARE_INTERNATIONAL
      : full;
  return Math.round(adjusted);
}

type Mode = "IN_PERSON" | "DONATE";

const offsetSchema = z.object({
  bookingId: z.string().min(1),
  projectId: z.enum(["yokdon", "lak", "corridor"]),
  // Bounded like every other figure that reaches the public ledger.
  kgCo2e: z.number().int().min(1).max(20_000),
  mode: z.enum(["IN_PERSON", "DONATE"]),
  origin: z.enum(["hcmc", "hanoi", "danang", "asia", "europe"]),
});

/** Ledger wording, so a reader can tell what kind of contribution this was. */
function ledgerLabel(projectId: ProjectId, mode: Mode, origin: string): string {
  const name = PROJECT_LEDGER_LABEL[projectId];
  if (mode === "IN_PERSON") return `${name} · a day's work`;
  // A long-haul donation covers the cost of running the session, not the
  // saplings — the Community Fund has already paid for those.
  if (PROJECTS[projectId].joinable && INTERNATIONAL_ORIGINS.has(origin)) {
    return `${name} · towards running the session`;
  }
  return name;
}

offsetsRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = offsetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
  }
  const { bookingId, projectId, kgCo2e, mode, origin } = parsed.data;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { listing: { select: { title: true } } },
  });

  // Not found and not-yours answer alike, so booking ids cannot be probed.
  if (!booking || booking.guestId !== req.user!.id) {
    return res.status(404).json({ error: "That booking is not on your account." });
  }
  if (booking.status === "CANCELLED") {
    return res.status(409).json({ error: "That booking was cancelled." });
  }

  const project = PROJECTS[projectId];
  const { nextActivityDate, eligible } = activityDuringStay(projectId, booking.checkIn, booking.nights);

  if (!project.joinable) {
    // The corridor is maintained year-round; there is no session to attend.
    if (mode !== "DONATE") {
      return res
        .status(400)
        .json({ error: "That project is maintained year-round and does not take visiting help." });
    }
  } else if (mode === "IN_PERSON" && !eligible) {
    // Still checked here rather than trusted from the client: the screen
    // disables the option, and a disabled control is a courtesy, not a
    // constraint.
    return res.status(400).json({
      error: "No planting day falls within those dates. You can contribute instead.",
    });
  }

  const amountVnd = amountFor(projectId, mode, kgCo2e, origin);

  const offset = await prisma.$transaction(async (tx) => {
    const saved = await tx.offsetContribution.upsert({
      where: { bookingId },
      create: { bookingId, projectId, kgCo2e, amountVnd, mode, origin },
      update: { projectId, kgCo2e, amountVnd, mode, origin },
    });

    // One ledger row per offset, replaced rather than added to when the
    // guest changes their mind. A contribution of work is not money, so it
    // gets no row at all — the ledger records what moved.
    await tx.ledgerEntry.deleteMany({ where: { offsetId: saved.id } });
    if (amountVnd > 0) {
      await tx.ledgerEntry.create({
        data: {
          offsetId: saved.id,
          fromLabel: `Traveler #${req.user!.id.slice(-4).toUpperCase()}`,
          toLabel: ledgerLabel(projectId, mode, origin),
          totalVnd: amountVnd,
          // An offset is not a sale: nothing retained, nothing split.
          platformFeeVnd: 0,
          communityFundVnd: 0,
        },
      });
    }

    return saved;
  });

  res.status(201).json({
    ...offset,
    listingTitle: booking.listing.title,
    nextActivityDate,
    eligible,
    settled: booking.status === "CONFIRMED" || booking.status === "COMPLETED",
  });
});

/**
 * The caller's bookings, each with any offset already attached and — for
 * every project that runs sessions — whether one falls inside that stay.
 *
 * Computed here so the tracker never has to re-derive a date the server
 * will judge it against.
 */
offsetsRouter.get("/bookings", requireAuth, async (req: AuthedRequest, res) => {
  const bookings = await prisma.booking.findMany({
    where: { guestId: req.user!.id, status: { not: "CANCELLED" } },
    include: {
      listing: { select: { title: true, provider: { select: { displayName: true, buon: true } } } },
      offset: true,
    },
    orderBy: [{ checkIn: "asc" }, { createdAt: "desc" }],
  });

  res.json(
    bookings.map((b) => ({
      id: b.id,
      status: b.status,
      checkIn: b.checkIn,
      nights: b.nights,
      guests: b.guests,
      listingTitle: b.listing.title,
      provider: b.listing.provider.displayName,
      buon: b.listing.provider.buon,
      offset: b.offset
        ? {
            projectId: b.offset.projectId,
            kgCo2e: b.offset.kgCo2e,
            amountVnd: b.offset.amountVnd,
            mode: b.offset.mode,
            origin: b.offset.origin,
          }
        : null,
      // Keyed by project, because eligibility depends on which schedule is
      // being asked about.
      activity: Object.fromEntries(
        (Object.keys(PROJECTS) as ProjectId[]).map((id) => [
          id,
          activityDuringStay(id, b.checkIn, b.nights),
        ])
      ),
    }))
  );
});

/** Remove an offset from a booking. */
offsetsRouter.delete("/:bookingId", requireAuth, async (req: AuthedRequest, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId },
    include: { offset: true },
  });
  if (!booking || booking.guestId !== req.user!.id) {
    return res.status(404).json({ error: "That booking is not on your account." });
  }
  if (!booking.offset) {
    return res.status(404).json({ error: "That booking has no offset." });
  }

  await prisma.$transaction(async (tx) => {
    await tx.ledgerEntry.deleteMany({ where: { offsetId: booking.offset!.id } });
    await tx.offsetContribution.delete({ where: { id: booking.offset!.id } });
  });

  res.json({ ok: true });
});
