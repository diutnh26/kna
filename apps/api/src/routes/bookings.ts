import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { splitBooking } from "../lib/fees";
import { requireAuth, requireCoordinator, type AuthedRequest } from "../middleware/auth";
import { getPaymentGateway } from "../payments/gateway";
import { coordinatorIds, notify, notifyAll } from "../lib/notify";

export const bookingsRouter = Router();

const createBookingSchema = z.object({
  listingId: z.string(),
  // Bounded, because both multiply straight into a money figure and a
  // public ledger row. The ceilings match the CHECK constraints.
  guests: z.number().int().min(1).max(20),
  nights: z.number().int().min(1).max(30).default(1),
  // A calendar date, not a timestamp: a stay begins on a day, and pinning
  // it to an instant would shift it across a timezone boundary. The Ê Đê
  // households and the guest are rarely in the same one.
  checkIn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "A check-in date is required (YYYY-MM-DD).")
    .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "That is not a real date."),
});

/** Today in UTC, as a date-only value, for comparing against check-in. */
function todayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Phase 1 is concierge-assisted: a booking is created PENDING and a
// community coordinator confirms it from the admin console (not built yet
// here) once availability and the guest's payment are verified. The fee
// split — and the public ledger row it produces — is computed at creation
// time regardless, because that's the number the transparency panel shows
// the guest *before* they commit to paying.
bookingsRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
  }
  const { listingId, guests, nights, checkIn } = parsed.data;

  const checkInDate = new Date(`${checkIn}T00:00:00Z`);
  if (checkInDate < todayUtc()) {
    return res.status(400).json({ error: "Check-in cannot be in the past." });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { provider: true },
  });
  if (!listing || !listing.published) {
    return res.status(404).json({ error: "Listing not found." });
  }

  const totalVnd = listing.priceVnd * (listing.unit === "per night" ? nights : guests);
  const { platformFeeVnd, communityFundVnd, providerPayoutVnd } = splitBooking(totalVnd);

  const booking = await prisma.booking.create({
    data: {
      listingId,
      guestId: req.user!.id,
      guests,
      checkIn: checkInDate,
      nights,
      totalVnd,
      platformFeeVnd,
      communityFundVnd,
      providerPayoutVnd,
      ledgerEntries: {
        create: {
          fromLabel: `Traveler #${req.user!.id.slice(-4).toUpperCase()}`,
          toLabel: listing.provider.displayName,
          totalVnd,
          platformFeeVnd,
          communityFundVnd,
        },
      },
    },
    include: { ledgerEntries: true },
  });

  // The household hears that somebody wants their dates, and whoever can
  // confirm hears there is something waiting. Neither is a side effect the
  // booking depends on — notify() never throws.
  const listingOwner = await prisma.provider.findUnique({
    where: { id: listing.providerId },
    select: { userId: true },
  });
  if (listingOwner) {
    await notify(prisma, {
      userId: listingOwner.userId,
      type: "BOOKING_RECEIVED",
      params: { listing: listing.title, date: checkIn, nights },
      href: "#dashboard",
    });
  }
  await notifyAll(prisma, await coordinatorIds(), {
    type: "BOOKING_AWAITING_DECISION",
    params: { listing: listing.title, date: checkIn },
    href: "#dashboard",
  });

  // What the guest is told about paying comes from the configured gateway,
  // not from hardcoded copy — so switching to VNPay/MoMo changes the
  // instruction everywhere at once instead of leaving stale promises.
  const payment = await getPaymentGateway().createIntent({
    reference: booking.id,
    amountVnd: booking.totalVnd,
    description: `KNĂ booking · ${listing.title}`,
  });

  // The relation is one-to-many in Prisma (see the note on LedgerEntry in
  // schema.prisma) but the rule is one entry per booking, enforced by a
  // filtered unique index. Respond with the single entry, not an array.
  const { ledgerEntries, ...rest } = booking;
  res.status(201).json({ ...rest, ledgerEntry: ledgerEntries[0] ?? null, payment });
});

bookingsRouter.get("/mine", requireAuth, async (req: AuthedRequest, res) => {
  const bookings = await prisma.booking.findMany({
    where: { guestId: req.user!.id },
    include: { listing: { include: { provider: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(bookings);
});

// ── Coordination ─────────────────────────────────────────────────────
// Phase 1 is concierge-assisted by design: a community coordinator checks
// availability with the household and confirms by hand. Without these
// routes a PENDING booking has nobody who can act on it, which is the
// gap that made the guest-facing "we'll be in touch" copy a promise the
// system couldn't keep.

/** The coordination queue — every booking still awaiting a decision. */
bookingsRouter.get(
  "/pending",
  requireAuth,
  requireCoordinator,
  async (_req: AuthedRequest, res) => {
    const bookings = await prisma.booking.findMany({
      where: { status: "PENDING" },
      include: {
        listing: { include: { provider: { select: { displayName: true, buon: true } } } },
        guest: { select: { fullName: true, email: true } },
      },
      // Soonest arrival first, not oldest request. A coordinator's queue is
      // ordered by what needs deciding before the guest turns up.
      orderBy: [{ checkIn: "asc" }, { createdAt: "asc" }],
    });
    res.json(bookings);
  }
);

const decisionSchema = z.object({ decision: z.enum(["confirm", "decline"]) });

bookingsRouter.post(
  "/:id/decision",
  requireAuth,
  requireCoordinator,
  async (req: AuthedRequest, res) => {
    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "A decision of 'confirm' or 'decline' is required." });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { listing: { select: { title: true } } },
    });
    const listing = booking?.listing;
    if (!booking) {
      return res.status(404).json({ error: "That booking no longer exists." });
    }
    if (booking.status !== "PENDING") {
      return res.status(409).json({ error: "That booking has already been decided." });
    }

    // A declined booking's ledger row goes with it: the public ledger
    // records money that moved, and no money moves on a decline.
    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.decision === "decline") {
        await tx.ledgerEntry.deleteMany({ where: { bookingId: booking.id } });
      }
      const saved = await tx.booking.update({
        where: { id: booking.id },
        data: { status: parsed.data.decision === "confirm" ? "CONFIRMED" : "CANCELLED" },
      });

      // Inside the transaction: a decline that rolls back must not leave
      // the guest holding a message saying it happened.
      await notify(tx, {
        userId: booking.guestId,
        type: parsed.data.decision === "confirm" ? "BOOKING_CONFIRMED" : "BOOKING_DECLINED",
        params: { listing: listing?.title ?? "", date: booking.checkIn.toISOString().slice(0, 10) },
        href: "#account",
      });

      return saved;
    });

    res.json(updated);
  }
);
