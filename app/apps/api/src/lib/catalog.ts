import { z } from "zod";
import type { Listing, Prisma, Product } from "@prisma/client";
import { LISTING_CATEGORIES, PRODUCT_CATEGORIES } from "./enums";
import { DAY_MS } from "./availability";

/**
 * Listings and products, as providers edit their own and admins edit any.
 * One set of rules for both, so the provider's screen and the admin console
 * cannot disagree about what a valid listing is or what deleting one does.
 *
 * Deleting follows the platform's rule for records other things depend on:
 * a listing with bookings (or a product with orders) is unpublished rather
 * than deleted, because those bookings and their ledger rows point at it.
 * Only a record nothing depends on is really deleted.
 */

export class CatalogError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

/** A photograph: an uploaded image's URL, or a path the web app serves. */
export const imageUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^https?:\/\//i.test(v) || v.startsWith("/"), "Image must be an uploaded image or a /path.");

const text = (max: number) => z.string().trim().min(1).max(max);

export const listingCreateSchema = z.object({
  category: z.enum(LISTING_CATEGORIES),
  title: text(120),
  blurb: text(2000),
  priceVnd: z.number().int().min(1_000).max(100_000_000),
  unit: z.enum(["per night", "per person"]),
  duration: text(80),
  groupSize: text(80),
  carbonRating: text(40),
  customs: z.string().trim().max(2000).nullable().optional(),
  imageUrl: imageUrlSchema.nullable().optional(),
  published: z.boolean().optional(),
  inventory: z.number().int().min(1).max(100),
  maxGuestsPerRoom: z.number().int().min(1).max(20),
});
export const listingUpdateSchema = listingCreateSchema.partial();

export const productCreateSchema = z.object({
  category: z.enum(PRODUCT_CATEGORIES),
  title: text(120),
  note: text(2000),
  priceVnd: z.number().int().min(1_000).max(100_000_000),
  stock: z.number().int().min(0).max(10_000),
  imageUrl: imageUrlSchema.nullable().optional(),
  published: z.boolean().optional(),
});
export const productUpdateSchema = productCreateSchema.partial();

export type ListingInput = z.infer<typeof listingCreateSchema>;
export type ProductInput = z.infer<typeof productCreateSchema>;

function todayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function createListing(tx: Prisma.TransactionClient, providerId: string, data: ListingInput) {
  return tx.listing.create({ data: { ...data, providerId, published: data.published ?? false } });
}

export async function updateListing(
  tx: Prisma.TransactionClient,
  listing: Listing,
  data: Partial<ListingInput>
) {
  if (data.unit && data.unit !== listing.unit) {
    // A booking holds days by unit (nights of a stay, one day of an
    // experience); changing it under existing bookings would release the
    // wrong days on a cancellation.
    const booked = await tx.booking.count({ where: { listingId: listing.id } });
    if (booked > 0) {
      throw new CatalogError("This listing has bookings, so it cannot switch between per night and per person.", 409);
    }
  }
  const updated = await tx.listing.update({ where: { id: listing.id }, data });
  if (data.inventory !== undefined && data.inventory !== listing.inventory) {
    // Open days from today on take the new capacity, never below what is
    // already booked on them.
    await tx.$executeRaw`
      UPDATE "AvailabilitySlot"
      SET "capacity" = GREATEST(${data.inventory}, "booked")
      WHERE "listingId" = ${listing.id} AND "date" >= ${todayUtc()}`;
  }
  return updated;
}

/** Delete a listing nothing depends on; otherwise unpublish it. */
export async function removeListing(tx: Prisma.TransactionClient, listing: Listing) {
  const bookings = await tx.booking.count({ where: { listingId: listing.id } });
  if (bookings > 0) {
    await tx.listing.update({ where: { id: listing.id }, data: { published: false } });
    return { outcome: "unpublished" as const, reason: `${bookings} booking(s) refer to it` };
  }
  await tx.availabilitySlot.deleteMany({ where: { listingId: listing.id } });
  await tx.listing.delete({ where: { id: listing.id } });
  return { outcome: "deleted" as const };
}

export async function createProduct(tx: Prisma.TransactionClient, providerId: string, data: ProductInput) {
  return tx.product.create({ data: { ...data, providerId, published: data.published ?? false } });
}

export async function updateProduct(tx: Prisma.TransactionClient, product: Product, data: Partial<ProductInput>) {
  return tx.product.update({ where: { id: product.id }, data });
}

/** Delete a product nothing depends on; otherwise unpublish it. */
export async function removeProduct(tx: Prisma.TransactionClient, product: Product) {
  const orders = await tx.orderItem.count({ where: { productId: product.id } });
  if (orders > 0) {
    await tx.product.update({ where: { id: product.id }, data: { published: false } });
    return { outcome: "unpublished" as const, reason: `${orders} order line(s) refer to it` };
  }
  await tx.product.delete({ where: { id: product.id } });
  return { outcome: "deleted" as const };
}

export const availabilitySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  open: z.boolean(),
});

/**
 * Open a range of days at the listing's full inventory, or close it.
 * Closing never takes away rooms that are already booked — those days
 * shrink to what is held instead.
 */
export async function setAvailability(
  tx: Prisma.TransactionClient,
  listing: Pick<Listing, "id" | "inventory">,
  range: z.infer<typeof availabilitySchema>
) {
  const start = new Date(`${range.from}T00:00:00Z`);
  const end = new Date(`${range.to}T00:00:00Z`);
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  if (!(days >= 1 && days <= 366)) {
    throw new CatalogError("The range must run forward and span at most a year.");
  }
  for (let i = 0; i < days; i++) {
    const date = new Date(start.getTime() + i * DAY_MS);
    if (range.open) {
      await tx.$executeRaw`
        INSERT INTO "AvailabilitySlot" ("id", "listingId", "date", "capacity", "booked")
        VALUES (${`slot_${listing.id}_${date.getTime()}`}, ${listing.id}, ${date}, ${listing.inventory}, 0)
        ON CONFLICT ("listingId", "date")
        DO UPDATE SET "capacity" = GREATEST(${listing.inventory}, "AvailabilitySlot"."booked")`;
    } else {
      await tx.availabilitySlot.deleteMany({ where: { listingId: listing.id, date, booked: 0 } });
      await tx.$executeRaw`
        UPDATE "AvailabilitySlot" SET "capacity" = "booked"
        WHERE "listingId" = ${listing.id} AND "date" = ${date}`;
    }
  }
  return days;
}
