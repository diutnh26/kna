-- Rooms, instant booking, and a database-level guarantee against overbooking.

ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "inventory" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "maxGuestsPerRoom" INTEGER NOT NULL DEFAULT 2;
-- Experiences hold seats, not rooms.
UPDATE "Listing" SET "inventory" = 10 WHERE "unit" = 'per person';

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "rooms" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "checkOut" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "onchainTx" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "onchainError" TEXT;

UPDATE "Booking" b
SET "checkOut" = b."checkIn" + make_interval(days => CASE WHEN l."unit" = 'per night' THEN b."nights" ELSE 1 END)
FROM "Listing" l
WHERE l."id" = b."listingId" AND b."checkOut" IS NULL;

-- Experiences book seats: an existing booking holds one seat per guest.
UPDATE "Booking" b SET "rooms" = b."guests"
FROM "Listing" l
WHERE l."id" = b."listingId" AND l."unit" = 'per person';

ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "CK_Booking_status";
ALTER TABLE "Booking" ADD CONSTRAINT "CK_Booking_status"
  CHECK ("status" IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'UNPAID'));

-- Recount every slot from the bookings that actually hold it. The old claim
-- never compared against `booked`, so these counts could be too high.
UPDATE "AvailabilitySlot" s
SET "booked" = COALESCE((
  SELECT SUM(b."rooms")
  FROM "Booking" b
  WHERE b."listingId" = s."listingId"
    AND b."status" IN ('PENDING', 'CONFIRMED', 'COMPLETED', 'UNPAID')
    AND s."date" >= b."checkIn" AND s."date" < b."checkOut"
), 0);

-- Capacity is rooms/seats now; never below what is already held.
UPDATE "AvailabilitySlot" s
SET "capacity" = GREATEST(l."inventory", s."booked")
FROM "Listing" l
WHERE l."id" = s."listingId";

ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "CK_AvailabilitySlot_booked"
  CHECK ("booked" >= 0 AND "booked" <= "capacity");
