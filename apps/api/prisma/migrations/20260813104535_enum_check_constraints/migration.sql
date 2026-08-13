-- Replaces the Prisma `enum` blocks the SQL Server connector cannot express.
-- Kept in step with src/lib/enums.ts: add a value there and here, or neither.

ALTER TABLE [dbo].[User] ADD CONSTRAINT [CK_User_role]
  CHECK ([role] IN ('GUEST', 'PROVIDER', 'COORDINATOR', 'COMMITTEE', 'ADMIN'));

ALTER TABLE [dbo].[Provider] ADD CONSTRAINT [CK_Provider_type]
  CHECK ([type] IN ('HOMESTAY', 'GUIDE', 'ARTISAN'));

ALTER TABLE [dbo].[Listing] ADD CONSTRAINT [CK_Listing_category]
  CHECK ([category] IN ('STAY', 'GUIDED_WALK', 'CRAFT_SESSION', 'CEREMONY'));

ALTER TABLE [dbo].[Booking] ADD CONSTRAINT [CK_Booking_status]
  CHECK ([status] IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'));

ALTER TABLE [dbo].[Order] ADD CONSTRAINT [CK_Order_status]
  CHECK ([status] IN ('PENDING', 'PAID', 'FULFILLED', 'CANCELLED'));

ALTER TABLE [dbo].[ArchiveEntry] ADD CONSTRAINT [CK_ArchiveEntry_moderationStatus]
  CHECK ([moderationStatus] IN ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'REJECTED'));

ALTER TABLE [dbo].[Phrase] ADD CONSTRAINT [CK_Phrase_moderationStatus]
  CHECK ([moderationStatus] IN ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'REJECTED'));
