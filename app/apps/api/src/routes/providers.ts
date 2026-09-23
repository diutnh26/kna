import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { OPEN_BOOKING_STATUSES, PAID_BOOKING_STATUSES } from "../lib/ledger";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { splitOrder } from "../lib/fees";

export const providersRouter = Router();

/**
 * The provider's own view of their business on the platform.
 *
 * The dossier's argument is that a transparent system whose beneficiaries
 * can't read it isn't empowerment, it's only technical transparency. So a
 * host sees their own bookings and — crucially — exactly what reaches
 * them versus what the platform and the Community Fund took.
 */
providersRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const provider = await prisma.provider.findUnique({
    where: { userId: req.user!.id },
    include: {
      listings: { orderBy: { createdAt: "desc" } },
      products: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!provider) {
    return res.status(404).json({ error: "This account is not a registered provider." });
  }

  const bookings = await prisma.booking.findMany({
    where: { listing: { providerId: provider.id } },
    include: {
      listing: { select: { title: true, unit: true } },
      guest: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const orderItems = await prisma.orderItem.findMany({
    where: { product: { providerId: provider.id } },
    include: {
      product: { select: { title: true } },
      order: { select: { id: true, status: true, createdAt: true, marketplaceFeeVnd: true, totalVnd: true } },
    },
    orderBy: { id: "desc" },
  });

  // Earned = money from bookings the household has actually delivered or
  // agreed to. PENDING is excluded: nobody has confirmed it yet, and
  // showing it as income would misrepresent what they can count on.
  // Earned once the guest has paid at check-out.
  const confirmed = bookings.filter((b) => PAID_BOOKING_STATUSES.includes(b.status));
  const bookingEarnedVnd = confirmed.reduce((sum, b) => sum + b.providerPayoutVnd, 0);
  const bookingFundVnd = confirmed.reduce((sum, b) => sum + b.communityFundVnd, 0);
  const bookingPlatformVnd = confirmed.reduce((sum, b) => sum + b.platformFeeVnd, 0);

  const paidItems = orderItems.filter(
    (i) => i.order.status === "PAID" || i.order.status === "FULFILLED"
  );
  const marketplaceGrossVnd = paidItems.reduce((sum, i) => sum + i.unitPriceVnd * i.quantity, 0);
  // Via splitOrder, not a second copy of 0.95. The rate agreed at realistic
  // amounts, so this was never a live discrepancy — but a rate written down
  // twice is one edit away from the household's dashboard disagreeing with
  // the public ledger, which is the one thing fees.ts exists to prevent.
  const marketplaceEarnedVnd = splitOrder(marketplaceGrossVnd).artisanPayoutVnd;

  res.json({
    provider: {
      id: provider.id,
      displayName: provider.displayName,
      type: provider.type,
      buon: provider.buon,
      verified: provider.verified,
    },
    listings: provider.listings,
    products: provider.products,
    bookings: bookings.map((b) => ({
      id: b.id,
      status: b.status,
      guests: b.guests,
      checkIn: b.checkIn,
      nights: b.nights,
      createdAt: b.createdAt,
      listingTitle: b.listing.title,
      guestName: b.guest.fullName,
      totalVnd: b.totalVnd,
      providerPayoutVnd: b.providerPayoutVnd,
      communityFundVnd: b.communityFundVnd,
      platformFeeVnd: b.platformFeeVnd,
      paymentRef: b.paymentRef,
      paymentStatus: b.paymentStatus,
      demoTxSigs: (() => {
        if (!b.demoTxSigs) return [] as string[];
        try {
          const parsed = JSON.parse(b.demoTxSigs);
          return Array.isArray(parsed) ? (parsed as string[]) : [];
        } catch {
          return [] as string[];
        }
      })(),
    })),
    orders: paidItems.map((i) => ({
      id: i.id,
      productTitle: i.product.title,
      quantity: i.quantity,
      grossVnd: i.unitPriceVnd * i.quantity,
      earnedVnd: splitOrder(i.unitPriceVnd * i.quantity).artisanPayoutVnd,
      status: i.order.status,
      createdAt: i.order.createdAt,
    })),
    totals: {
      bookingEarnedVnd,
      bookingFundVnd,
      bookingPlatformVnd,
      marketplaceGrossVnd,
      marketplaceEarnedVnd,
      pendingBookings: bookings.filter((b) => OPEN_BOOKING_STATUSES.includes(b.status)).length,
    },
  });
});

const availabilitySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  open: z.boolean(),
});

/**
 * The provider verifies their own calendar: open a range of days at the
 * listing's full inventory, or close it. Closing never takes away rooms that
 * are already booked — those days shrink to what is held instead. Guests
 * can then book any open day without further approval.
 */
providersRouter.put("/me/listings/:id/availability", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = availabilitySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "from, to (YYYY-MM-DD) and open are required." });
  }
  const listing = await prisma.listing.findFirst({
    where: { id: req.params.id, provider: { userId: req.user!.id } },
  });
  if (!listing) {
    return res.status(404).json({ error: "That listing is not yours." });
  }
  const start = new Date(`${parsed.data.from}T00:00:00Z`);
  const end = new Date(`${parsed.data.to}T00:00:00Z`);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days < 1 || days > 366) {
    return res.status(400).json({ error: "The range must run forward and span at most a year." });
  }

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < days; i++) {
      const date = new Date(start.getTime() + i * 86_400_000);
      if (parsed.data.open) {
        await tx.$executeRaw`
          INSERT INTO "AvailabilitySlot" ("id", "listingId", "date", "capacity", "booked")
          VALUES (${`slot_${listing.id}_${date.getTime()}`}, ${listing.id}, ${date}, ${listing.inventory}, 0)
          ON CONFLICT ("listingId", "date")
          DO UPDATE SET "capacity" = GREATEST(${listing.inventory}, "AvailabilitySlot"."booked")`;
      } else {
        await tx.availabilitySlot.deleteMany({ where: { listingId: listing.id, date, booked: 0 } });
        await tx.$executeRaw`
          UPDATE "AvailabilitySlot" SET "capacity" = "booked"
          WHERE "listingId" = ${listing.id} AND "date" = ${date}`;
      }
    }
  });
  res.json({ ok: true, days });
});
