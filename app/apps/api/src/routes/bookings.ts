import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { splitBooking } from "../lib/fees";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { notify } from "../lib/notify";
import {
  AvailabilityError,
  addDays,
  claimDays,
  dateOnly,
  daysHeld,
} from "../lib/availability";
import { enqueueBookingRecord } from "../chain/bookings-onchain-queue";
import { DecisionError, cancelBooking } from "../lib/decisions";
import {
  PAYABLE_STATUSES,
  completePayment,
  hasUnpaidBooking,
  payWithPlatformWallet,
  paymentOpen,
} from "../lib/checkout";
import {
  PaymentError,
  confirmPhantomPayment,
  payingBalanceVnd,
  payingWallet,
  preparePhantomPayment,
} from "../chain/payments-onchain";

export const bookingsRouter = Router();

/**
 * Bookings are confirmed instantly: the provider has already opened these
 * dates on their calendar, so there is nothing left to approve. What must
 * hold is that no two guests get the same room — see lib/availability.ts.
 */

const createBookingSchema = z.object({
  listingId: z.string(),
  guests: z.number().int().min(1).max(20),
  nights: z.number().int().min(1).max(30).default(1),
  // Stays only; defaults to as few rooms as fit the guests.
  rooms: z.number().int().min(1).max(10).optional(),
  checkIn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "A check-in date is required (YYYY-MM-DD).")
    .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "That is not a real date."),
});

function todayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

bookingsRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
  }
  const { listingId, guests, nights } = parsed.data;

  const checkIn = dateOnly(parsed.data.checkIn);
  if (checkIn < todayUtc()) {
    return res.status(400).json({ error: "Check-in cannot be in the past." });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { provider: true },
  });
  if (!listing || !listing.published) {
    return res.status(404).json({ error: "Listing not found." });
  }

  const perNight = listing.unit === "per night";
  // Rooms for a stay, seats for an experience.
  const units = perNight
    ? parsed.data.rooms ?? Math.ceil(guests / listing.maxGuestsPerRoom)
    : guests;
  if (perNight && guests > units * listing.maxGuestsPerRoom) {
    return res.status(400).json({
      error: `${units} room(s) sleep at most ${units * listing.maxGuestsPerRoom} guests.`,
    });
  }
  const days = daysHeld(listing.unit, nights);
  const checkOut = addDays(checkIn, days);
  const totalVnd = perNight ? listing.priceVnd * nights * units : listing.priceVnd * guests;
  const { platformFeeVnd, communityFundVnd, providerPayoutVnd } = splitBooking(totalVnd);

  // A guest who still owes for a stay settles it before booking another.
  if (await hasUnpaidBooking(req.user!.id)) {
    return res.status(409).json({ error: "Please pay your unpaid stay before booking another." });
  }
  // Payment comes from the guest's wallet at check-out: check now that it
  // can cover the stay (a check, not a hold). Skipped when the dKNA rail is
  // not configured, or the balance cannot be read right now.
  const balance = await payingBalanceVnd(req.user!.id);
  if (balance !== null && balance < totalVnd) {
    return res.status(402).json({
      error: "Your wallet does not hold enough dKNA for this stay yet. Top up first.",
      requiredVnd: totalVnd,
      balanceVnd: balance,
    });
  }

  let booking;
  try {
    booking = await prisma.$transaction(async (tx) => {
      await claimDays(tx, listing.id, checkIn, days, units);
      return tx.booking.create({
        data: {
          listingId,
          guestId: req.user!.id,
          guests,
          rooms: units,
          checkIn,
          checkOut,
          nights: perNight ? nights : 1,
          totalVnd,
          platformFeeVnd,
          communityFundVnd,
          providerPayoutVnd,
          status: "CONFIRMED",
          decidedAt: new Date(),
          decidedVia: "INSTANT",
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
    if (err instanceof AvailabilityError) {
      const day = err.date.toISOString().slice(0, 10);
      return res.status(409).json({
        error:
          err.code === "NO_SLOT"
            ? `${day} is not open for booking.`
            : `${day} is fully booked.`,
        date: day,
      });
    }
    throw err;
  }

  await enqueueBookingRecord(prisma, booking.id);
  await notify(prisma, {
    userId: req.user!.id,
    type: "BOOKING_CONFIRMED",
    params: { listing: listing.title, date: parsed.data.checkIn },
    href: "#account",
  });
  await notify(prisma, {
    userId: listing.provider.userId,
    type: "BOOKING_RECEIVED",
    params: { listing: listing.title, date: parsed.data.checkIn, nights },
    href: "#dashboard",
  });

  const { ledgerEntries, ...rest } = booking;
  res.status(201).json({ ...rest, ledgerEntry: ledgerEntries[0] ?? null });
});

bookingsRouter.get("/mine", requireAuth, async (req: AuthedRequest, res) => {
  const bookings = await prisma.booking.findMany({
    where: { guestId: req.user!.id },
    include: { listing: { include: { provider: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(bookings);
});

/**
 * Pay at check-out. From the check-out date (Vietnam time), the guest pays
 * the booked split from their paying wallet: the platform signs with the
 * fixed wallet it holds; a linked Phantom gets a transaction to sign, then
 * /pay/confirm. Nothing is paid until the booking record on-chain says so.
 */
bookingsRouter.post("/:id/pay", requireAuth, async (req: AuthedRequest, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking || booking.guestId !== req.user!.id) {
    return res.status(404).json({ error: "That booking is not on your account." });
  }
  if (!PAYABLE_STATUSES.includes(booking.status)) {
    return res.status(409).json({ error: "This booking is not awaiting payment.", status: booking.status });
  }
  if (!paymentOpen(booking.checkOut)) {
    return res.status(409).json({
      error: `Payment opens on your check-out date, ${booking.checkOut?.toISOString().slice(0, 10)}.`,
    });
  }
  if (!booking.onchainTx) {
    return res.status(409).json({ error: "This booking is still being recorded on-chain. Try again shortly." });
  }
  try {
    const wallet = await payingWallet(req.user!.id);
    if (!wallet.custodial) {
      const transactionBase64 = await preparePhantomPayment(booking.id, wallet.pubkey);
      return res.json({ needsSignature: true, wallet: wallet.pubkey.toBase58(), transactionBase64 });
    }
    const payTx = await payWithPlatformWallet(booking.id, req.user!.id, "GUEST");
    res.json(await prisma.booking.findUnique({ where: { id: booking.id } }).then((b) => ({ ...b, payTx })));
  } catch (err) {
    if (err instanceof PaymentError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

bookingsRouter.post("/:id/pay/confirm", requireAuth, async (req: AuthedRequest, res) => {
  const signature = typeof req.body?.signature === "string" ? req.body.signature : "";
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking || booking.guestId !== req.user!.id) {
    return res.status(404).json({ error: "That booking is not on your account." });
  }
  if (!PAYABLE_STATUSES.includes(booking.status)) {
    return res.status(409).json({ error: "This booking is not awaiting payment.", status: booking.status });
  }
  try {
    const wallet = await payingWallet(req.user!.id);
    await confirmPhantomPayment(booking.id, wallet.pubkey, signature);
    await completePayment(booking.id, signature, req.user!.id, "PHANTOM");
    res.json(await prisma.booking.findUnique({ where: { id: booking.id } }));
  } catch (err) {
    if (err instanceof PaymentError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

/**
 * Cancel before check-in: by the guest, or by a coordinator. The dates go
 * back on the calendar and the ledger row is voided (never deleted).
 */
bookingsRouter.post("/:id/cancel", requireAuth, async (req: AuthedRequest, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  const isStaff = req.user!.role === "COORDINATOR" || req.user!.role === "ADMIN";
  if (!booking || (booking.guestId !== req.user!.id && !isStaff)) {
    return res.status(404).json({ error: "That booking is not on your account." });
  }
  try {
    const via = isStaff && booking.guestId !== req.user!.id ? "COORDINATOR" : "GUEST";
    res.json(await cancelBooking(booking.id, req.user!.id, via));
  } catch (err) {
    if (err instanceof DecisionError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});
