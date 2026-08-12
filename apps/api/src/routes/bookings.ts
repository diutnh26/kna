import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { splitBooking } from "../lib/fees";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

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
