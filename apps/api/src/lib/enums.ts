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
export const BOOKING_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"] as const;
export const ORDER_STATUSES = ["PENDING", "PAID", "FULFILLED", "CANCELLED"] as const;
export const MODERATION_STATUSES = ["DRAFT", "IN_REVIEW", "PUBLISHED", "REJECTED"] as const;

// ── The assistant ────────────────────────────────────────────────────

/** What a knowledge card is about. Drives nothing but grouping, so far. */
export const CARD_TOPICS = ["etiquette", "culture", "language", "logistics", "platform"] as const;

/**
 * Which answer tier produced a reply.
 *
 *   A — a Committee-approved answer, returned verbatim. No generation.
 *   B — generated from retrieved passages, with citations.
 *   C — declined. Now reserved for when no model is reachable, or the
 *       general fallback itself failed.
 *   D — answered from the model's general knowledge because the archive
 *       had nothing, clearly labelled as such in the UI. The honest
 *       middle ground between citing and stonewalling.
 *
 * Recorded on every flag, because a complaint about a tier A answer is a
 * content problem and the same complaint about tier B may be a retrieval
 * problem. They are worked through differently.
 */
export const ANSWER_TIERS = ["A", "B", "C", "D"] as const;

export const FLAG_STATUSES = ["OPEN", "ACTIONED", "DISMISSED"] as const;

/** How a knowledge document is used at query time. See schema.prisma. */
export const DOCUMENT_KINDS = ["QUESTION", "PASSAGE"] as const;

export const DOCUMENT_SOURCE_TYPES = [
  "KnowledgeCard",
  "ArchiveEntry",
  "Phrase",
  "Listing",
  // A chunk of a PDF/DOCX file from apps/api/data — project reference
  // material ingested by the sync, not a moderated database record.
  // CHECK constraint updated by the `reference_documents` migration.
  "ReferenceDocument",
  // A published marketplace product — the assistant answers questions
  // about what artisans sell. CHECK constraint updated by the
  // `product_documents` migration.
  "Product",
  // The website's own prose, from the frontend locale files (landing,
  // explore, carbon…). CHECK constraint: `site_and_governance` migration.
  "SiteContent",
  // Committee membership, decisions, and Community Fund allocations —
  // the governance record the Community screen shows. Same migration.
  "Governance",
] as const;

export type Role = (typeof ROLES)[number];
export type ProviderType = (typeof PROVIDER_TYPES)[number];
export type ListingCategory = (typeof LISTING_CATEGORIES)[number];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];
export type CardTopic = (typeof CARD_TOPICS)[number];
export type AnswerTier = (typeof ANSWER_TIERS)[number];
export type FlagStatus = (typeof FLAG_STATUSES)[number];
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export type DocumentSourceType = (typeof DOCUMENT_SOURCE_TYPES)[number];

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
  // Added by the `assistant` migration rather than `enum_check_constraints`,
  // because the tables did not exist when that one ran.
  { table: "KnowledgeCard", column: "moderationStatus", values: MODERATION_STATUSES },
  { table: "KnowledgeCard", column: "topic", values: CARD_TOPICS },
  { table: "KnowledgeDocument", column: "kind", values: DOCUMENT_KINDS },
  { table: "KnowledgeDocument", column: "sourceType", values: DOCUMENT_SOURCE_TYPES },
  { table: "AssistantFlag", column: "tier", values: ANSWER_TIERS },
  { table: "AssistantFlag", column: "status", values: FLAG_STATUSES },
] as const;
