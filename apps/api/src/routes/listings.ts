import { Router } from "express";
import type { ListingCategory, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export const listingsRouter = Router();

const CATEGORIES = ["STAY", "GUIDED_WALK", "CRAFT_SESSION", "CEREMONY"] as const;
function isListingCategory(value: unknown): value is ListingCategory {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

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
    where.OR = [
      { title: { contains: term } },
      { blurb: { contains: term } },
      { provider: { displayName: { contains: term } } },
      { provider: { buon: { contains: term } } },
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
