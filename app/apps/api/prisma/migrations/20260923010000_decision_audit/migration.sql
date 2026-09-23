-- Who decided a booking or order, when, and through which path.

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "decidedById" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "decidedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "decidedVia" TEXT;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "decidedById" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "decidedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "decidedVia" TEXT;
