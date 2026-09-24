import { prisma } from "./prisma";
import { notify } from "./notify";
import { voidLedgerEntries } from "./ledger";
import { daysHeld, releaseDays } from "./availability";
import { enqueueBookingCancel } from "../chain/bookings-onchain-queue";
import { enqueueLedgerSettledOutbox } from "../chain/outbox";

/**
 * Money decisions shared by the routes that take them and the admin
 * console, so both follow one set of rules: dates go back on the calendar,
 * ledger rows are voided (never deleted), and the chain is told.
 */

export class DecisionError extends Error {
  constructor(
    message: string,
    public readonly status = 409
  ) {
    super(message);
  }
}

function todayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Cancel a booking before check-in. */
export async function cancelBooking(bookingId: string, actorUserId: string, via: string, reason = "booking cancelled") {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { listing: { select: { title: true, unit: true } } },
  });
  if (!booking) throw new DecisionError("That booking no longer exists.", 404);
  if (booking.checkIn <= todayUtc()) {
    throw new DecisionError("A stay can only be cancelled before check-in.");
  }

  const cancelled = await prisma.$transaction(async (tx) => {
    const claimed = await tx.booking.updateMany({
      where: { id: booking.id, status: { in: ["PENDING", "CONFIRMED"] } },
      data: { status: "CANCELLED", decidedById: actorUserId, decidedAt: new Date(), decidedVia: via },
    });
    if (claimed.count !== 1) return null;
    await releaseDays(
      tx,
      booking.listingId,
      booking.checkIn,
      daysHeld(booking.listing.unit, booking.nights),
      booking.rooms
    );
    await voidLedgerEntries(tx, { bookingId: booking.id }, reason, actorUserId);
    await notify(tx, {
      userId: booking.guestId,
      type: "BOOKING_DECLINED",
      params: { listing: booking.listing.title, date: booking.checkIn.toISOString().slice(0, 10) },
      href: "#account",
    });
    return tx.booking.findUnique({ where: { id: booking.id } });
  });

  if (!cancelled) throw new DecisionError("That booking can no longer be cancelled.");
  if (booking.onchainTx) await enqueueBookingCancel(prisma, booking.id);
  return cancelled;
}

/** Settle (payment received) or cancel a pending marketplace order. */
export async function decideOrder(
  orderId: string,
  decision: "settle" | "cancel",
  actorUserId: string,
  via: string
) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) throw new DecisionError("That order no longer exists.", 404);

  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: {
        status: decision === "settle" ? "PAID" : "CANCELLED",
        decidedById: actorUserId,
        decidedAt: new Date(),
        decidedVia: via,
      },
    });
    if (claimed.count !== 1) return null;

    if (decision === "cancel") {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
      await voidLedgerEntries(tx, { orderId: order.id }, "order cancelled", actorUserId);
    } else {
      const ledger = await tx.ledgerEntry.findFirst({ where: { orderId: order.id } });
      if (ledger) await enqueueLedgerSettledOutbox(tx, ledger.id);
    }

    await notify(tx, {
      userId: order.buyerId,
      type: decision === "settle" ? "ORDER_SETTLED" : "ORDER_CANCELLED",
      params: { count: order.items.reduce((n, i) => n + i.quantity, 0) },
      href: "#account",
    });
    return tx.order.findUnique({ where: { id: order.id } });
  });

  if (!updated) throw new DecisionError("That order has already been decided.");
  return updated;
}
