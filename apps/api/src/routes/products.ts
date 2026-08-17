import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export const productsRouter = Router();

// Public — the real version of Marketplace.jsx's PRODUCTS array.
productsRouter.get("/", async (req, res) => {
  const { category, q } = req.query;

  // Sold-out pieces stay on the list.
  //
  // They used to be filtered out here, which made the card's own "Sold
  // out" state unreachable — the client renders it, and no response could
  // ever trigger it. Worse, a buyer could open their account, see the
  // piece they bought, and find no trace of it in the marketplace.
  //
  // Hiding them also misrepresents the place. Most of this work is
  // one-of-a-kind; "Stock is literal" is the marketplace's own stated
  // position, and a piece that sold is evidence the model works, not an
  // absence to be tidied away.
  const where: Prisma.ProductWhereInput = { published: true };
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

  // What can be bought comes first; sold pieces keep their place below,
  // newest first within each group. Sorted here rather than in the query
  // because "in stock at all" is not a column, and the catalogue is small.
  products.sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0));

  res.json(products);
});
