import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireCoordinator, type AuthedRequest } from "../middleware/auth";
import { getPaymentGateway } from "../payments/gateway";
import { VietQRGateway } from "../payments/vietqr-gateway";
import { syncTransaction } from "../payments/vietqr-token";
import { fundEscrow } from "../chain/demo-token";
import { notify } from "../lib/notify";
import { enqueueLedgerSettledOutbox } from "../chain/outbox";

export const paymentsRouter = Router();

type PaidTarget =
  | { kind: "booking"; id: string }
  | { kind: "order"; id: string };

async function findByPaymentRef(paymentRef: string): Promise<PaidTarget | null> {
  const booking = await prisma.booking.findFirst({
    where: { paymentRef },
    select: { id: true },
  });
  if (booking) return { kind: "booking", id: booking.id };

  const order = await prisma.order.findFirst({
    where: { paymentRef },
    select: { id: true },
  });
  if (order) return { kind: "order", id: order.id };

  return null;
}

/** Who marked a payment: a coordinator syncing the bank, or the bank's webhook. */
type PaidBy = { userId: string | null; via: "PAYMENT_VERIFY" | "PAYMENT_WEBHOOK" };

function decisionFields(paidBy: PaidBy) {
  return { decidedById: paidBy.userId, decidedAt: new Date(), decidedVia: paidBy.via };
}

async function markBookingPaid(bookingId: string, paidBy: PaidBy, expectedAmountVnd?: number) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      listing: { include: { provider: true } },
      ledgerEntries: true,
    },
  });
  if (!booking) return null;

  if (
    expectedAmountVnd !== undefined &&
    Number.isFinite(expectedAmountVnd) &&
    expectedAmountVnd > 0 &&
    expectedAmountVnd !== booking.totalVnd
  ) {
    throw new Error(
      `Webhook amount ${expectedAmountVnd} does not match booking total ${booking.totalVnd}.`
    );
  }

  // Atomic claim — only one concurrent webhook/verify wins.
  const claimed = await prisma.booking.updateMany({
    where: { id: booking.id, paymentStatus: { not: "PAID" } },
    data: {
      paymentStatus: "PAID",
      paymentPaidAt: new Date(),
      status: booking.status === "PENDING" ? "CONFIRMED" : booking.status,
      // Only a PENDING booking is decided here; one a coordinator already
      // decided keeps that decision's trace.
      ...(booking.status === "PENDING" ? decisionFields(paidBy) : {}),
    },
  });

  const alreadyPaid = claimed.count !== 1;
  if (alreadyPaid && booking.demoTxSigs) {
    return booking;
  }

  // The payment enters escrow on devnet. Nobody is paid here: the program
  // pays the escrow out (settle_split) once the committee finalizes.
  let demoTxSigs: string[] = [];
  try {
    demoTxSigs = await fundEscrow({ id: booking.id, totalVnd: booking.totalVnd });
  } catch (err) {
    console.error("[payments] fundEscrow failed:", err);
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      demoTxSigs: demoTxSigs.length ? JSON.stringify(demoTxSigs) : booking.demoTxSigs,
      demoDisburseAt: demoTxSigs.length ? new Date() : booking.demoDisburseAt,
    },
    include: { listing: true, ledgerEntries: true },
  });

  if (!alreadyPaid) {
    const ledgerEntry = updated.ledgerEntries[0];
    if (ledgerEntry) {
      await enqueueLedgerSettledOutbox(prisma, ledgerEntry.id);
    }

    await notify(prisma, {
      userId: booking.guestId,
      type: "BOOKING_CONFIRMED",
      params: {
        listing: booking.listing.title,
        date: booking.checkIn.toISOString().slice(0, 10),
      },
      href: "#account",
    });
  }

  return updated;
}

async function markOrderPaid(orderId: string, paidBy: PaidBy, expectedAmountVnd?: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } }, ledgerEntries: true },
  });
  if (!order) return null;

  if (
    expectedAmountVnd !== undefined &&
    Number.isFinite(expectedAmountVnd) &&
    expectedAmountVnd > 0 &&
    expectedAmountVnd !== order.totalVnd
  ) {
    throw new Error(
      `Webhook amount ${expectedAmountVnd} does not match order total ${order.totalVnd}.`
    );
  }

  const claimed = await prisma.order.updateMany({
    where: { id: order.id, paymentStatus: { not: "PAID" } },
    data: {
      paymentStatus: "PAID",
      paymentPaidAt: new Date(),
      status: "PAID",
      ...(order.status === "PENDING" ? decisionFields(paidBy) : {}),
    },
  });
  if (claimed.count !== 1) {
    return order;
  }

  const updated = await prisma.order.findUnique({
    where: { id: order.id },
    include: { ledgerEntries: true },
  });
  if (!updated) return null;

  const ledgerEntry = updated.ledgerEntries[0];
  if (ledgerEntry) {
    await enqueueLedgerSettledOutbox(prisma, ledgerEntry.id);
  }

  return updated;
}

async function applyPaid(paymentRef: string, paidBy: PaidBy, expectedAmountVnd?: number) {
  const target = await findByPaymentRef(paymentRef);
  if (!target) {
    return { ok: false as const, error: "No booking/order for that payment reference." };
  }
  if (target.kind === "booking") {
    const booking = await markBookingPaid(target.id, paidBy, expectedAmountVnd);
    return { ok: true as const, kind: "booking" as const, booking };
  }
  const order = await markOrderPaid(target.id, paidBy, expectedAmountVnd);
  return { ok: true as const, kind: "order" as const, order };
}

/**
 * Public webhook from VietQR proxy / bank sync.
 * Auth: Bearer PAYMENT_WEBHOOK_TOKEN or HMAC X-Webhook-Signature.
 */
paymentsRouter.post("/webhook", async (req, res) => {
  try {
    const gateway = getPaymentGateway();
    if (!(gateway instanceof VietQRGateway) && gateway.name !== "vietqr") {
      // Still allow verify if someone mounted vietqr-only verification
    }

    const vietqr = gateway instanceof VietQRGateway ? gateway : new VietQRGateway();
    const headers: Record<string, string | undefined> = {
      authorization: req.header("authorization") ?? undefined,
      "x-webhook-signature": req.header("x-webhook-signature") ?? undefined,
    };

    const verified = await vietqr.verifyCallback(req.body, headers);
    if (verified.status !== "PAID") {
      return res.json({ ok: true, ignored: true, status: verified.status });
    }

    const paymentRef = verified.paymentRef ?? verified.reference;
    const result = await applyPaid(
      paymentRef,
      { userId: null, via: "PAYMENT_WEBHOOK" },
      verified.amountVnd
    );
    if (!result.ok) {
      return res.status(404).json({ error: result.error });
    }

    let demoTxSigs: string[] = [];
    try {
      demoTxSigs =
        result.kind === "booking" && result.booking?.demoTxSigs
          ? JSON.parse(result.booking.demoTxSigs)
          : [];
    } catch {
      demoTxSigs = [];
    }

    res.json({
      ok: true,
      kind: result.kind,
      paymentRef,
      demoTxSigs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook failed.";
    if (message.includes("authentication")) {
      return res.status(401).json({ error: message });
    }
    console.error(err);
    return res.status(400).json({ error: message });
  }
});

/**
 * Coordinator manual check via VietQR transaction-sync proxy.
 */
paymentsRouter.post(
  "/verify/:ref",
  requireAuth,
  requireCoordinator,
  async (req: AuthedRequest, res) => {
    const ref = String(req.params.ref ?? "").trim();
    if (!ref) {
      return res.status(400).json({ error: "Payment reference is required." });
    }

    try {
      const synced = await syncTransaction(ref);
      if (!synced) {
        return res.status(404).json({ error: "No matching bank transaction yet." });
      }
      if (synced.status !== "PAID") {
        return res.json({ ok: false, status: synced.status, synced });
      }

      const result = await applyPaid(
        synced.reference || ref,
        { userId: req.user!.id, via: "PAYMENT_VERIFY" },
        synced.amount
      );
      if (!result.ok) {
        return res.status(404).json({ error: result.error });
      }

      res.json({
        ok: true,
        kind: result.kind,
        paymentRef: synced.reference || ref,
        booking: result.kind === "booking" ? result.booking : undefined,
        order: result.kind === "order" ? result.order : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verify failed.";
      console.error(err);
      return res.status(502).json({ error: message });
    }
  }
);

/** Guest/coordinator poll for demo mint status after booking. */
paymentsRouter.get("/status/:ref", requireAuth, async (req: AuthedRequest, res) => {
  const ref = String(req.params.ref ?? "").trim();
  const isStaff = req.user!.role === "COORDINATOR" || req.user!.role === "ADMIN";

  const booking = await prisma.booking.findFirst({
    where: isStaff
      ? { paymentRef: ref }
      : { paymentRef: ref, guestId: req.user!.id },
    select: {
      id: true,
      guestId: true,
      paymentRef: true,
      paymentStatus: true,
      paymentPaidAt: true,
      demoTxSigs: true,
      demoDisburseAt: true,
      status: true,
    },
  });

  if (booking) {
    return res.json({
      kind: "booking",
      ...booking,
      demoTxSigs: booking.demoTxSigs ? JSON.parse(booking.demoTxSigs) : [],
    });
  }

  const order = await prisma.order.findFirst({
    where: isStaff
      ? { paymentRef: ref }
      : { paymentRef: ref, buyerId: req.user!.id },
    select: {
      id: true,
      paymentRef: true,
      paymentStatus: true,
      paymentPaidAt: true,
      status: true,
    },
  });
  if (!order) {
    return res.status(404).json({ error: "Not found." });
  }
  res.json({ kind: "order", ...order });
});

function parseDemoTxSigs(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Shared demo mint ledger (guest / provider / staff / public Community).
 * Guest email is never returned — names + amounts + Explorer links only.
 */
paymentsRouter.get("/demo-history", async (_req, res) => {
  const rows = await prisma.booking.findMany({
    where: {
      OR: [{ demoTxSigs: { not: null } }, { paymentStatus: "PAID" }],
    },
    select: {
      id: true,
      createdAt: true,
      paymentPaidAt: true,
      demoDisburseAt: true,
      paymentRef: true,
      paymentStatus: true,
      status: true,
      totalVnd: true,
      providerPayoutVnd: true,
      communityFundVnd: true,
      platformFeeVnd: true,
      demoTxSigs: true,
      guest: { select: { fullName: true } },
      listing: {
        select: {
          title: true,
          provider: { select: { displayName: true, buon: true } },
        },
      },
    },
    orderBy: [{ demoDisburseAt: "desc" }, { paymentPaidAt: "desc" }, { createdAt: "desc" }],
    take: 40,
  });

  res.json({
    disclaimer: "Demo token — không phải thanh toán thật. Devnet only.",
    rate: { symbol: "dKNA", vndPerToken: 1000 },
    items: rows.map((b) => ({
      id: b.id,
      at: b.demoDisburseAt ?? b.paymentPaidAt ?? b.createdAt,
      paymentRef: b.paymentRef,
      paymentStatus: b.paymentStatus,
      bookingStatus: b.status,
      title: b.listing.title,
      guestName: b.guest.fullName,
      providerName: b.listing.provider.displayName,
      buon: b.listing.provider.buon,
      totalVnd: b.totalVnd,
      providerPayoutVnd: b.providerPayoutVnd,
      communityFundVnd: b.communityFundVnd,
      platformFeeVnd: b.platformFeeVnd,
      demoTxSigs: parseDemoTxSigs(b.demoTxSigs),
      explorer: parseDemoTxSigs(b.demoTxSigs).map(
        (sig) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`
      ),
    })),
  });
});
