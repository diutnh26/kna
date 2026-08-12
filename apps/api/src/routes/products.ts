import { Router } from "express";
import { prisma } from "../lib/prisma";

export const productsRouter = Router();

// Public — the real version of Marketplace.jsx's PRODUCTS array.
productsRouter.get("/", async (req, res) => {
  const { category } = req.query;

  const products = await prisma.product.findMany({
    where: {
      published: true,
      stock: { gt: 0 },
      ...(typeof category === "string" ? { category } : {}),
    },
    include: { provider: true },
    orderBy: { createdAt: "desc" },
  });

  res.json(products);
});
