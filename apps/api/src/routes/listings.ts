import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { isListingCategory } from "../lib/enums";

export const listingsRouter = Router();

// Public — this is what apps/web's Travel.jsx switches to once it stops
// reading its local LISTINGS array.
listingsRouter.get("/", async (req, res) => {
  const { category, buon, q } = req.query;

  const where: Prisma.ListingWhereInput = { published: true };
  if (isListingCategory(category)) where.category = category;
  if (typeof buon === "string") where.provider = { buon };

  // Free-text search across the things a guest would actually type: a
  // host's name, a buôn, or a word from the listing itself.
  if (typeof q === "string" && q.trim()) {
    const term = q.trim();
    // mode:'insensitive' is required, not cosmetic: Postgres `contains`
    // is case-sensitive, so without it searching "wik" would not find
    // "Y Wik Niê" — which is exactly how a guest would type it.
    where.OR = [
      { title: { contains: term, mode: 'insensitive' } },
      { blurb: { contains: term, mode: 'insensitive' } },
      { provider: { displayName: { contains: term, mode: 'insensitive' } } },
      { provider: { buon: { contains: term, mode: 'insensitive' } } },
    ];
  }

  const listings = await prisma.listing.findMany({
    where,
    include: { provider: true },
    orderBy: { createdAt: "desc" },
  });

  res.json(listings);
});

listingsRouter.get("/:id", async (req, res) => {
  const listing = await prisma.listing.findUnique({
    where: { id: req.params.id },
    include: { provider: true, slots: true },
  });
  if (!listing || !listing.published) {
    return res.status(404).json({ error: "Listing not found." });
  }
  res.json(listing);
});
