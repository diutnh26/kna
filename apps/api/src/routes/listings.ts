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
  const { category, buon } = req.query;

  const where: Prisma.ListingWhereInput = { published: true };
  if (isListingCategory(category)) where.category = category;
  if (typeof buon === "string") where.provider = { buon };

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
