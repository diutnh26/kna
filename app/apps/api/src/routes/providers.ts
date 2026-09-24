import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { OPEN_BOOKING_STATUSES, PAID_BOOKING_STATUSES } from "../lib/ledger";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { splitOrder } from "../lib/fees";
import {
  CatalogError,
  availabilitySchema,
  createListing,
  createProduct,
  imageUrlSchema,
  listingCreateSchema,
  listingUpdateSchema,
  productCreateSchema,
  productUpdateSchema,
  removeListing,
  removeProduct,
  setAvailability,
  updateListing,
  updateProduct,
} from "../lib/catalog";

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
      bio: provider.bio,
      imageUrl: provider.imageUrl,
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
  try {
    const days = await prisma.$transaction((tx) => setAvailability(tx, listing, parsed.data));
    res.json({ ok: true, days });
  } catch (err) {
    if (err instanceof CatalogError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

// ── The provider's own catalogue ─────────────────────────────────────
// A provider creates, edits and removes their own listings and products,
// photographs included. Publishing needs a provider KNĂ has verified: an
// unverified household can prepare everything, and it goes live once they
// are verified. Removing something that has bookings or orders unpublishes
// it instead (lib/catalog.ts).

async function myProvider(req: AuthedRequest) {
  return prisma.provider.findUnique({ where: { userId: req.user!.id } });
}

function catalogError(res: import("express").Response, err: unknown) {
  if (err instanceof CatalogError) return res.status(err.status).json({ error: err.message });
  throw err;
}

const NOT_VERIFIED = "Your household must be verified by KNĂ before anything can be published.";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  imageUrl: imageUrlSchema.nullable().optional(),
});

providersRouter.patch("/me", requireAuth, async (req: AuthedRequest, res) => {
  const provider = await myProvider(req);
  if (!provider) return res.status(404).json({ error: "This account is not a registered provider." });
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
  }
  res.json(await prisma.provider.update({ where: { id: provider.id }, data: parsed.data }));
});

providersRouter.post("/me/listings", requireAuth, async (req: AuthedRequest, res) => {
  const provider = await myProvider(req);
  if (!provider) return res.status(404).json({ error: "This account is not a registered provider." });
  const parsed = listingCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
  }
  if (parsed.data.published && !provider.verified) return res.status(403).json({ error: NOT_VERIFIED });
  const listing = await prisma.$transaction((tx) => createListing(tx, provider.id, parsed.data));
  res.status(201).json(listing);
});

providersRouter.patch("/me/listings/:id", requireAuth, async (req: AuthedRequest, res) => {
  const provider = await myProvider(req);
  const listing = provider
    ? await prisma.listing.findFirst({ where: { id: req.params.id, providerId: provider.id } })
    : null;
  if (!provider || !listing) return res.status(404).json({ error: "That listing is not yours." });
  const parsed = listingUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
  }
  if (parsed.data.published && !provider.verified) return res.status(403).json({ error: NOT_VERIFIED });
  try {
    res.json(await prisma.$transaction((tx) => updateListing(tx, listing, parsed.data)));
  } catch (err) {
    catalogError(res, err);
  }
});

providersRouter.delete("/me/listings/:id", requireAuth, async (req: AuthedRequest, res) => {
  const provider = await myProvider(req);
  const listing = provider
    ? await prisma.listing.findFirst({ where: { id: req.params.id, providerId: provider.id } })
    : null;
  if (!provider || !listing) return res.status(404).json({ error: "That listing is not yours." });
  res.json(await prisma.$transaction((tx) => removeListing(tx, listing)));
});

providersRouter.post("/me/products", requireAuth, async (req: AuthedRequest, res) => {
  const provider = await myProvider(req);
  if (!provider) return res.status(404).json({ error: "This account is not a registered provider." });
  const parsed = productCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
  }
  if (parsed.data.published && !provider.verified) return res.status(403).json({ error: NOT_VERIFIED });
  const product = await prisma.$transaction((tx) => createProduct(tx, provider.id, parsed.data));
  res.status(201).json(product);
});

providersRouter.patch("/me/products/:id", requireAuth, async (req: AuthedRequest, res) => {
  const provider = await myProvider(req);
  const product = provider
    ? await prisma.product.findFirst({ where: { id: req.params.id, providerId: provider.id } })
    : null;
  if (!provider || !product) return res.status(404).json({ error: "That product is not yours." });
  const parsed = productUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
  }
  if (parsed.data.published && !provider.verified) return res.status(403).json({ error: NOT_VERIFIED });
  res.json(await prisma.$transaction((tx) => updateProduct(tx, product, parsed.data)));
});

providersRouter.delete("/me/products/:id", requireAuth, async (req: AuthedRequest, res) => {
  const provider = await myProvider(req);
  const product = provider
    ? await prisma.product.findFirst({ where: { id: req.params.id, providerId: provider.id } })
    : null;
  if (!provider || !product) return res.status(404).json({ error: "That product is not yours." });
  res.json(await prisma.$transaction((tx) => removeProduct(tx, product)));
});
