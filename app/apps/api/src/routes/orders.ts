import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { splitOrder } from "../lib/fees";
import { requireAuth, requireCoordinator, type AuthedRequest } from "../middleware/auth";
import { coordinatorIds, notifyAll } from "../lib/notify";
import { DecisionError, decideOrder } from "../lib/decisions";
import { getPaymentGateway } from "../payments/gateway";

export const ordersRouter = Router();

const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        // Bounded. These multiply into a money figure and a public ledger
        // row, so "any positive integer" is not a safe domain.
        quantity: z.number().int().min(1).max(50),
      })
    )
    .min(1)
    .max(20),
});

/** Raised inside the transaction so a lost race rolls the whole order back. */
class OutOfStock extends Error {
  constructor(public readonly title: string, public readonly remaining: number) {
    super("out of stock");
  }
}

ordersRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
  }

  const products = await prisma.product.findMany({
    // `published` matters here, not only on the public list: without it an
    // unlisted or withdrawn piece stays purchasable by anyone who kept its id.
    where: { id: { in: parsed.data.items.map((i) => i.productId) }, published: true },
    include: { provider: true },
  });

  if (products.length !== parsed.data.items.length) {
    return res.status(404).json({ error: "One or more products are no longer available." });
  }

  // The ledger writes a single row per order, attributed to one maker. A
  // cart spanning two artisans would publicly credit the whole sale to
  // whichever came first in the array. The frontend sends one product at a
  // time, so this rejects nothing a person can currently do — it stops the
  // API from quietly misattributing money. Lifting it means one ledger row
  // per provider, which also means dropping UX_LedgerEntry_orderId.
  const providerIds = new Set(products.map((p) => p.providerId));
  if (providerIds.size > 1) {
    return res.status(400).json({
      error: "Each order can hold pieces from one maker. Please order from them separately.",
    });
  }

  // A friendly, early answer for the ordinary case. It is NOT what keeps
  // stock correct — the conditional decrement below is. Two buyers arriving
  // together both pass this.
  for (const item of parsed.data.items) {
    const product = products.find((p) => p.id === item.productId)!;
    if (product.stock < item.quantity) {
      return res.status(409).json({ error: `Only ${product.stock} left of "${product.title}".` });
    }
  }

  const totalVnd = parsed.data.items.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId)!;
    return sum + product.priceVnd * item.quantity;
  }, 0);
  const { marketplaceFeeVnd } = splitOrder(totalVnd);
  // Safe because multi-maker carts are rejected above, so every product
  // here shares one provider.
  const primaryMaker = products[0].provider.displayName;

  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      // Claim the stock BEFORE writing the order, and make the claim
      // conditional on the stock still being there. `updateMany` with
      // `stock: { gte }` compiles to a single UPDATE … WHERE stock >= n, so
      // the check and the write are one atomic statement and the loser of a
      // race updates zero rows.
      //
      // The previous version checked stock outside the transaction and then
      // decremented unconditionally. Eight simultaneous buyers for one
      // basket produced five orders and left stock at -4: five people each
      // told a one-of-a-kind object was theirs. tests/concurrency.test.ts
      // reproduces exactly that.
      for (const item of parsed.data.items) {
        const claimed = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (claimed.count !== 1) {
          const fresh = await tx.product.findUnique({ where: { id: item.productId } });
          const product = products.find((p) => p.id === item.productId)!;
          throw new OutOfStock(product.title, fresh?.stock ?? 0);
        }
      }

      return tx.order.create({
        data: {
          buyerId: req.user!.id,
          totalVnd,
          marketplaceFeeVnd,
          items: {
            create: parsed.data.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPriceVnd: products.find((p) => p.id === item.productId)!.priceVnd,
            })),
          },
          ledgerEntries: {
            create: {
              fromLabel: `Traveler #${req.user!.id.slice(-4).toUpperCase()}`,
              toLabel: primaryMaker,
              totalVnd,
              platformFeeVnd: marketplaceFeeVnd,
              communityFundVnd: 0,
            },
          },
        },
        include: { items: true, ledgerEntries: true },
      });
    });
  } catch (err) {
    if (err instanceof OutOfStock) {
      return res.status(409).json({
        error:
          err.remaining > 0
            ? `Only ${err.remaining} left of "${err.title}".`
            : `"${err.title}" has just sold out.`,
      });
    }
    throw err;
  }

  await notifyAll(prisma, await coordinatorIds(), {
    type: "ORDER_AWAITING_SETTLEMENT",
    params: { piece: products[0].title, maker: primaryMaker },
    href: "#dashboard",
  });

  const payment = await getPaymentGateway().createIntent({
    reference: order.id,
    amountVnd: order.totalVnd,
    description: `KNĂ marketplace · ${products[0].title}`,
  });

  let orderOut = order;
  if (payment.paymentRef) {
    orderOut = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentRef: payment.paymentRef,
        paymentStatus: payment.status,
      },
      include: { items: true, ledgerEntries: true },
    });
  }

  const { ledgerEntries, ...rest } = orderOut;
  res.status(201).json({ ...rest, ledgerEntry: ledgerEntries[0] ?? null, payment });
});

// ── Settlement ───────────────────────────────────────────────────────
// Orders were created PENDING and nothing ever moved them. Two things
// followed from that, both invisible: the provider dashboard filters
// marketplace income on PAID/FULFILLED, so artisans saw zero marketplace
// earnings no matter how much they sold; and once the public ledger began
// showing only settled rows, no marketplace sale could ever appear on it.
//
// Under manual settlement the buyer pays the maker directly and a
// coordinator records it, exactly as with a booking.

/** Orders awaiting a payment record. */
ordersRouter.get("/pending", requireAuth, requireCoordinator, async (_req: AuthedRequest, res) => {
  const orders = await prisma.order.findMany({
    where: { status: "PENDING" },
    include: {
      buyer: { select: { fullName: true, email: true } },
      items: { include: { product: { select: { title: true, providerId: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  res.json(orders);
});

const orderDecisionSchema = z.object({ decision: z.enum(["settle", "cancel"]) });

ordersRouter.post(
  "/:id/decision",
  requireAuth,
  requireCoordinator,
  async (req: AuthedRequest, res) => {
    const parsed = orderDecisionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "A decision of 'settle' or 'cancel' is required." });
    }

    try {
      res.json(await decideOrder(req.params.id, parsed.data.decision, req.user!.id, "COORDINATOR"));
    } catch (err) {
      if (err instanceof DecisionError) return res.status(err.status).json({ error: err.message });
      throw err;
    }
  }
);
