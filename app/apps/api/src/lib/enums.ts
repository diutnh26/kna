/**
 * The values that used to be Prisma `enum` blocks.
 *
 * Prisma's SQL Server connector doesn't support enums, so these columns are
 * plain strings. Declaring the permitted values here keeps three things in
 * agreement: the TypeScript types below, runtime validation at the API
 * boundary, and the CHECK constraints on the database itself (added by the
 * `enum_check_constraints` migration, generated from this same list).
 *
 * Add a value here, then add it to that migration. Both, or neither.
 */

export const ROLES = ["GUEST", "PROVIDER", "COORDINATOR", "COMMITTEE", "ADMIN"] as const;
export const PROVIDER_TYPES = ["HOMESTAY", "GUIDE", "ARTISAN"] as const;
export const LISTING_CATEGORIES = ["STAY", "GUIDED_WALK", "CRAFT_SESSION", "CEREMONY"] as const;
// The marketplace filter row; CK_Product_category holds the same list.
export const PRODUCT_CATEGORIES = ["Textile", "Basketry", "Woodwork", "Coffee", "Jewellery"] as const;
// CONFIRMED: booked, dates locked (instant). COMPLETED: paid at check-out.
// UNPAID: past check-out and its grace period without payment. PENDING only
// on bookings made before instant confirmation.
export const BOOKING_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "UNPAID"] as const;
export const ORDER_STATUSES = ["PENDING", "PAID", "FULFILLED", "CANCELLED"] as const;
export const MODERATION_STATUSES = ["DRAFT", "IN_REVIEW", "PUBLISHED", "REJECTED"] as const;

export type Role = (typeof ROLES)[number];
export type ProviderType = (typeof PROVIDER_TYPES)[number];
export type ListingCategory = (typeof LISTING_CATEGORIES)[number];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export function isListingCategory(value: unknown): value is ListingCategory {
  return typeof value === "string" && (LISTING_CATEGORIES as readonly string[]).includes(value);
}

/** Every column that carries one of these value sets, for the CHECK constraints. */
export const ENUM_COLUMNS = [
  { table: "User", column: "role", values: ROLES },
  { table: "Provider", column: "type", values: PROVIDER_TYPES },
  { table: "Listing", column: "category", values: LISTING_CATEGORIES },
  { table: "Booking", column: "status", values: BOOKING_STATUSES },
  { table: "Order", column: "status", values: ORDER_STATUSES },
  { table: "ArchiveEntry", column: "moderationStatus", values: MODERATION_STATUSES },
  { table: "Phrase", column: "moderationStatus", values: MODERATION_STATUSES },
] as const;
