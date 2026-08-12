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
    where.OR = [
      { title: { contains: term } },
      { note: { contains: term } },
      { provider: { displayName: { contains: term } } },
      { provider: { buon: { contains: term } } },
    ];
  }

  const products = await prisma.product.findMany({
    where,
    include: { provider: true },
    orderBy: { createdAt: "desc" },
  });

  res.json(products);
});
