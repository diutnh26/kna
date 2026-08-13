import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { splitOrder } from "../lib/fees";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

export const ordersRouter = Router();

const createOrderSchema = z.object({
  items: z.array(z.object({ productId: z.string(), quantity: z.number().int().min(1) })).min(1),
});

ordersRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
  }

  const products = await prisma.product.findMany({
    where: { id: { in: parsed.data.items.map((i) => i.productId) } },
    include: { provider: true },
  });

  if (products.length !== parsed.data.items.length) {
    return res.status(404).json({ error: "One or more products no longer exist." });
  }
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
  // Every order in this MVP is single-maker, so the ledger's "to" is that
  // maker; a mixed-cart order would need one ledger row per provider instead.
  const primaryMaker = products[0].provider.displayName;

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
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

    for (const item of parsed.data.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    return created;
  });

  const { ledgerEntries, ...rest } = order;
  res.status(201).json({ ...rest, ledgerEntry: ledgerEntries[0] ?? null });
});
