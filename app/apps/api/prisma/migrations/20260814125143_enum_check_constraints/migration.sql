-- Stands in for the Prisma `enum` blocks this schema deliberately avoids,
-- so the permitted values are enforced by the database and not only by the
-- application. Generated from src/lib/enums.ts: add a value there and here,
-- or neither.

ALTER TABLE "User" ADD CONSTRAINT "CK_User_role"
  CHECK ("role" IN ('GUEST', 'PROVIDER', 'COORDINATOR', 'COMMITTEE', 'ADMIN'));

ALTER TABLE "Provider" ADD CONSTRAINT "CK_Provider_type"
  CHECK ("type" IN ('HOMESTAY', 'GUIDE', 'ARTISAN'));

ALTER TABLE "Listing" ADD CONSTRAINT "CK_Listing_category"
  CHECK ("category" IN ('STAY', 'GUIDED_WALK', 'CRAFT_SESSION', 'CEREMONY'));

ALTER TABLE "Booking" ADD CONSTRAINT "CK_Booking_status"
  CHECK ("status" IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'));

ALTER TABLE "Order" ADD CONSTRAINT "CK_Order_status"
  CHECK ("status" IN ('PENDING', 'PAID', 'FULFILLED', 'CANCELLED'));

ALTER TABLE "ArchiveEntry" ADD CONSTRAINT "CK_ArchiveEntry_moderationStatus"
  CHECK ("moderationStatus" IN ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'REJECTED'));

ALTER TABLE "Phrase" ADD CONSTRAINT "CK_Phrase_moderationStatus"
  CHECK ("moderationStatus" IN ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'REJECTED'));
