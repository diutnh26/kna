import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { splitBooking } from "../lib/fees";
import { requireAuth, requireCoordinator, type AuthedRequest } from "../middleware/auth";
import { getPaymentGateway } from "../payments/gateway";
import { coordinatorIds, notify, notifyAll } from "../lib/notify";
import { enqueueLedgerSettledOutbox } from "../chain/outbox";

export const bookingsRouter = Router();

const createBookingSchema = z.object({
  listingId: z.string(),
  guests: z.number().int().min(1).max(20),
  nights: z.number().int().min(1).max(30).default(1),
  checkIn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "A check-in date is required (YYYY-MM-DD).")
    .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "That is not a real date."),
});

function todayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Each night of a stay must have available capacity on AvailabilitySlot. */
function nightsForListing(unit: string, guests: number, nights: number) {
  return unit === "per night" ? nights : 1;
}

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
  const nightCount = nightsForListing(listing.unit, guests, nights);

  let booking;
  try {
    booking = await prisma.$transaction(async (tx) => {
      for (let i = 0; i < nightCount; i++) {
        const slotDate = new Date(checkInDate.getTime() + i * 86_400_000);
        const claimed = await tx.availabilitySlot.updateMany({
          where: {
            listingId,
            date: slotDate,
            capacity: { gte: guests },
          },
          data: { booked: { increment: guests } },
        });
        if (claimed.count === 0) {
          const slot = await tx.availabilitySlot.findUnique({
            where: { listingId_date: { listingId, date: slotDate } },
          });
          if (!slot) {
            throw new Error("NO_SLOT");
          }
          throw new Error("NO_CAPACITY");
        }
      }

      return tx.booking.create({
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
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NO_SLOT") {
      return res.status(409).json({ error: "Those dates are not open for booking yet." });
    }
    if (err instanceof Error && err.message === "NO_CAPACITY") {
      return res.status(409).json({ error: "Not enough capacity for those dates." });
    }
    throw err;
  }

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

  const payment = await getPaymentGateway().createIntent({
    reference: booking.id,
    amountVnd: booking.totalVnd,
    description: `KNĂ booking · ${listing.title}`,
  });

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
      orderBy: [{ checkIn: "asc" }, { createdAt: "asc" }],
    });
    res.json(bookings);
  }
);

const decisionSchema = z.object({ decision: z.enum(["confirm", "decline"]) });

async function releaseBookingSlots(
  tx: Prisma.TransactionClient,
  listingId: string,
  checkIn: Date,
  nights: number,
  guests: number,
  unit: string
) {
  const nightCount = nightsForListing(unit, guests, nights);
  for (let i = 0; i < nightCount; i++) {
    const slotDate = new Date(checkIn.getTime() + i * 86_400_000);
    await tx.availabilitySlot.updateMany({
      where: { listingId, date: slotDate, booked: { gte: guests } },
      data: { booked: { decrement: guests } },
    });
  }
}

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
      include: { listing: { select: { title: true, unit: true } }, ledgerEntries: true },
    });
    const listing = booking?.listing;
    if (!booking) {
      return res.status(404).json({ error: "That booking no longer exists." });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.booking.updateMany({
        where: { id: booking.id, status: "PENDING" },
        data: { status: parsed.data.decision === "confirm" ? "CONFIRMED" : "CANCELLED" },
      });
      if (claimed.count !== 1) {
        return null;
      }

      if (parsed.data.decision === "decline") {
        await releaseBookingSlots(
          tx,
          booking.listingId,
          booking.checkIn,
          booking.nights,
          booking.guests,
          listing?.unit ?? "per night"
        );
        await tx.ledgerEntry.deleteMany({ where: { bookingId: booking.id } });
      } else {
        const ledgerEntry = booking.ledgerEntries[0];
        if (ledgerEntry) {
          await enqueueLedgerSettledOutbox(tx, ledgerEntry.id);
        }
      }

      await notify(tx, {
        userId: booking.guestId,
        type: parsed.data.decision === "confirm" ? "BOOKING_CONFIRMED" : "BOOKING_DECLINED",
        params: { listing: listing?.title ?? "", date: booking.checkIn.toISOString().slice(0, 10) },
        href: "#account",
      });

      return tx.booking.findUnique({ where: { id: booking.id } });
    });

    if (!updated) {
      return res.status(409).json({ error: "That booking has already been decided." });
    }

    res.json(updated);
  }
);
