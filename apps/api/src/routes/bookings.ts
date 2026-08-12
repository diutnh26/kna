import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { splitBooking } from "../lib/fees";
import { requireAuth, requireCoordinator, type AuthedRequest } from "../middleware/auth";

export const bookingsRouter = Router();

const createBookingSchema = z.object({
  listingId: z.string(),
  guests: z.number().int().min(1),
  nights: z.number().int().min(1).default(1),
});

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
  const { listingId, guests, nights } = parsed.data;

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
      totalVnd,
      platformFeeVnd,
      communityFundVnd,
      providerPayoutVnd,
      ledgerEntry: {
        create: {
          fromLabel: `Traveler #${req.user!.id.slice(-4).toUpperCase()}`,
          toLabel: listing.provider.displayName,
          totalVnd,
          platformFeeVnd,
          communityFundVnd,
        },
      },
    },
    include: { ledgerEntry: true },
  });

  res.status(201).json(booking);
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
      orderBy: { createdAt: "asc" },
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

    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
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
      return tx.booking.update({
        where: { id: booking.id },
        data: { status: parsed.data.decision === "confirm" ? "CONFIRMED" : "CANCELLED" },
      });
    });

    res.json(updated);
  }
);
