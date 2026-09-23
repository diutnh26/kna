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

/**
 * The listing's calendar: every open day in the range with its capacity and
 * what is left (rooms for a stay, seats for an experience). A day that is
 * not listed is not open. Public — a guest picks dates from this.
 */
listingsRouter.get("/:id/availability", async (req, res) => {
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  const from = typeof req.query.from === "string" && ymd.test(req.query.from) ? req.query.from : null;
  const to = typeof req.query.to === "string" && ymd.test(req.query.to) ? req.query.to : null;
  if (!from || !to) {
    return res.status(400).json({ error: "from and to are required (YYYY-MM-DD)." });
  }
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (end < start || end.getTime() - start.getTime() > 366 * 86_400_000) {
    return res.status(400).json({ error: "The range must run forward and span at most a year." });
  }
  const listing = await prisma.listing.findUnique({
    where: { id: req.params.id },
    select: { published: true, unit: true, inventory: true, maxGuestsPerRoom: true },
  });
  if (!listing || !listing.published) {
    return res.status(404).json({ error: "Listing not found." });
  }
  const slots = await prisma.availabilitySlot.findMany({
    where: { listingId: req.params.id, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });
  res.json({
    unit: listing.unit,
    inventory: listing.inventory,
    maxGuestsPerRoom: listing.maxGuestsPerRoom,
    days: slots.map((s) => ({
      date: s.date.toISOString().slice(0, 10),
      capacity: s.capacity,
      booked: s.booked,
      available: Math.max(0, s.capacity - s.booked),
    })),
  });
});
