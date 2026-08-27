-- Photographs for the records that render one.
--
-- A URL rather than bytes: files live under apps/web/public/images today,
-- which needs no storage account and survives on Render's free tier because
-- they are part of the build rather than written at runtime. Moving to
-- object storage later changes the value in this column and nothing else —
-- no migration, no component change.
--
-- Nullable throughout. A record without a photograph is a normal state, not
-- a broken one; the UI falls back to a labelled placeholder, which is also
-- what a provider sees before they have sent one in.
ALTER TABLE "Provider"     ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Listing"      ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Product"      ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "ArchiveEntry" ADD COLUMN "imageUrl" TEXT;
