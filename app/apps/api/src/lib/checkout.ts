import { prisma } from "./prisma";
import { DAY_MS } from "./availability";
import { coordinatorIds, notify, notifyAll } from "./notify";
import { enqueueLedgerSettledOutbox } from "../chain/outbox";
import {
  PaymentError,
  markUnpaidOnChain,
  payFromPlatformWallet,
  payingWallet,
} from "../chain/payments-onchain";

/**
 * Payment at check-out.
 *
 * Payment opens at 00:00 on the check-out date in Vietnam. The guest taps
 * Pay; if they have not by the next day they are reminded again, and at the
 * end of that day the platform charges the wallet it holds (the guest agreed
 * to this at booking). A charge that cannot go through — no funds, or the
 * guest pays from Phantom, whose key the platform does not hold — leaves the
 * booking UNPAID: still payable, and blocking new bookings until it is.
 */

const VN_OFFSET_MS = 7 * 3_600_000;

/** Today's date in Vietnam, as the UTC midnight dates are stored in. */
export function vnToday(now = new Date()) {
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()));
}

export function paymentOpen(checkOut: Date | null, now = new Date()) {
  return checkOut !== null && vnToday(now).getTime() >= checkOut.getTime();
}

export const PAYABLE_STATUSES = ["CONFIRMED", "UNPAID"];

/** After pay_booking is verified on-chain: the booking is paid, and its proof is queued. */
export async function completePayment(bookingId: string, payTx: string, actorUserId: string | null, via: string) {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { listing: { include: { provider: true } }, ledgerEntries: { where: { voidedAt: null } } },
  });
  const done = await prisma.$transaction(async (tx) => {
    const claimed = await tx.booking.updateMany({
      where: { id: bookingId, status: { in: PAYABLE_STATUSES } },
      data: {
        status: "COMPLETED",
        paymentStatus: "PAID",
        paymentPaidAt: new Date(),
        payTx,
        demoTxSigs: JSON.stringify([payTx]),
        demoDisburseAt: new Date(),
      },
    });
    if (claimed.count !== 1) return false;
    // Now it is money: attest it, for the committee to finalize.
    const entry = booking.ledgerEntries[0];
    if (entry) await enqueueLedgerSettledOutbox(tx, entry.id);
    await tx.chainAuditLog.create({
      data: { actorUserId, action: "PAY_BOOKING", ledgerEntryId: entry?.id, detail: `${payTx} · ${via}` },
    });
    const params = {
      listing: booking.listing.title,
      date: booking.checkIn.toISOString().slice(0, 10),
      amount: booking.totalVnd,
    };
    await notify(tx, { userId: booking.guestId, type: "BOOKING_PAID", params, href: "#account" });
    await notify(tx, {
      userId: booking.listing.provider.userId,
      type: "BOOKING_PAID",
      params,
      href: "#dashboard",
    });
    return true;
  });
  return done;
}

/** The guest pays from the platform-held wallet (the route's path for it). */
export async function payWithPlatformWallet(bookingId: string, actorUserId: string | null, via: string) {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const sig = await payFromPlatformWallet(bookingId, booking.guestId);
  await completePayment(bookingId, sig, actorUserId, via);
  return sig;
}

/** Any bookings this guest still owes: they cannot book again until settled. */
export async function hasUnpaidBooking(userId: string) {
  return (await prisma.booking.count({ where: { guestId: userId, status: "UNPAID" } })) > 0;
}

/**
 * One pass of the check-out job: reminders, then the automatic charge, then
 * UNPAID. Each step happens once per booking (reminderStage).
 */
export async function runCheckoutJobOnce(now = new Date()) {
  const today = vnToday(now);
  const due = await prisma.booking.findMany({
    where: { status: "CONFIRMED", checkOut: { lte: today }, reminderStage: { lt: 3 } },
    include: { listing: { include: { provider: true } } },
  });
  const summary = { reminded: 0, charged: 0, unpaid: 0 };

  for (const b of due) {
    const checkOut = b.checkOut!;
    const params = {
      listing: b.listing.title,
      date: checkOut.toISOString().slice(0, 10),
      amount: b.totalVnd,
    };

    if (b.reminderStage < 1) {
      await prisma.booking.update({ where: { id: b.id }, data: { reminderStage: 1 } });
      await notify(prisma, { userId: b.guestId, type: "PAYMENT_DUE", params, href: "#account" });
      summary.reminded++;
      continue;
    }

    if (b.reminderStage < 2 && today.getTime() >= checkOut.getTime() + DAY_MS) {
      await prisma.booking.update({ where: { id: b.id }, data: { reminderStage: 2 } });
      await notify(prisma, { userId: b.guestId, type: "PAYMENT_OVERDUE", params, href: "#account" });
      summary.reminded++;
      continue;
    }

    if (b.reminderStage < 3 && today.getTime() >= checkOut.getTime() + 2 * DAY_MS) {
      // A stay that never reached the chain could not have been paid there:
      // that is the platform's gap, not the guest's debt. Leave it for a
      // coordinator rather than marking the guest UNPAID.
      if (!b.onchainTx) {
        console.warn("[checkout] not charging, never recorded on-chain:", b.id);
        continue;
      }
      await prisma.booking.update({ where: { id: b.id }, data: { reminderStage: 3 } });
      let charged = false;
      try {
        const wallet = await payingWallet(b.guestId);
        if (wallet.custodial && b.onchainTx) {
          await payWithPlatformWallet(b.id, null, "AUTO_CHARGE");
          charged = true;
        }
      } catch (err) {
        if (!(err instanceof PaymentError)) console.error("[checkout] auto-charge failed:", b.id, err);
      }
      if (charged) {
        summary.charged++;
        continue;
      }

      await prisma.booking.updateMany({ where: { id: b.id, status: "CONFIRMED" }, data: { status: "UNPAID" } });
      if (b.onchainTx) {
        await markUnpaidOnChain(b.id).catch((err) => console.error("[checkout] mark_unpaid failed:", b.id, err));
      }
      await notify(prisma, { userId: b.guestId, type: "BOOKING_UNPAID", params, href: "#account" });
      await notify(prisma, { userId: b.listing.provider.userId, type: "BOOKING_UNPAID", params, href: "#dashboard" });
      await notifyAll(prisma, await coordinatorIds(), { type: "BOOKING_UNPAID", params, href: "#dashboard" });
      summary.unpaid++;
    }
  }
  return summary;
}
