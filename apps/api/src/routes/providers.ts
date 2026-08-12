import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

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
  const confirmed = bookings.filter((b) => b.status === "CONFIRMED" || b.status === "COMPLETED");
  const bookingEarnedVnd = confirmed.reduce((sum, b) => sum + b.providerPayoutVnd, 0);
  const bookingFundVnd = confirmed.reduce((sum, b) => sum + b.communityFundVnd, 0);
  const bookingPlatformVnd = confirmed.reduce((sum, b) => sum + b.platformFeeVnd, 0);

  const paidItems = orderItems.filter(
    (i) => i.order.status === "PAID" || i.order.status === "FULFILLED"
  );
  const marketplaceGrossVnd = paidItems.reduce((sum, i) => sum + i.unitPriceVnd * i.quantity, 0);
  const marketplaceEarnedVnd = Math.round(marketplaceGrossVnd * 0.95);

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
      createdAt: b.createdAt,
      listingTitle: b.listing.title,
      guestName: b.guest.fullName,
      totalVnd: b.totalVnd,
      providerPayoutVnd: b.providerPayoutVnd,
      communityFundVnd: b.communityFundVnd,
      platformFeeVnd: b.platformFeeVnd,
    })),
    orders: paidItems.map((i) => ({
      id: i.id,
      productTitle: i.product.title,
      quantity: i.quantity,
      grossVnd: i.unitPriceVnd * i.quantity,
      earnedVnd: Math.round(i.unitPriceVnd * i.quantity * 0.95),
      status: i.order.status,
      createdAt: i.order.createdAt,
    })),
    totals: {
      bookingEarnedVnd,
      bookingFundVnd,
      bookingPlatformVnd,
      marketplaceGrossVnd,
      marketplaceEarnedVnd,
      pendingBookings: bookings.filter((b) => b.status === "PENDING").length,
    },
  });
});
