import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export const productsRouter = Router();

// Public — the real version of Marketplace.jsx's PRODUCTS array.
productsRouter.get("/", async (req, res) => {
  const { category, q } = req.query;

  const where: Prisma.ProductWhereInput = { published: true, stock: { gt: 0 } };
  if (typeof category === "string") where.category = category;

  // Matches a maker, a material, or a word from the piece's description.
  if (typeof q === "string" && q.trim()) {
    const term = q.trim();
    // mode:'insensitive' is required, not cosmetic: Postgres `contains`
    // is case-sensitive, so without it searching "wik" would not find
    // "Y Wik Niê" — which is exactly how a guest would type it.
    where.OR = [
      { title: { contains: term, mode: 'insensitive' } },
      { note: { contains: term, mode: 'insensitive' } },
      { provider: { displayName: { contains: term, mode: 'insensitive' } } },
      { provider: { buon: { contains: term, mode: 'insensitive' } } },
    ];
  }

  const products = await prisma.product.findMany({
    where,
    include: { provider: true },
    orderBy: { createdAt: "desc" },
  });

  res.json(products);
});
