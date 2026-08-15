-- Bookings never recorded when the guest was arriving.
--
-- `nights` was accepted by the API and used to price the stay, then thrown
-- away; there was no date field of any kind. A coordinator opening the
-- confirmation queue could not tell the household which nights to hold, and
-- the total could not be reconciled against the inputs that produced it.
--
-- Existing rows (none in production, a handful in dev) get today's date and
-- 1 night so the NOT NULL can be added without a separate backfill pass.
ALTER TABLE "Booking"
  ADD COLUMN "checkIn" DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN "nights" INTEGER NOT NULL DEFAULT 1;

-- The default was only to make the column addition safe. New bookings must
-- supply a real date.
ALTER TABLE "Booking" ALTER COLUMN "checkIn" DROP DEFAULT;

ALTER TABLE "Booking"
  ADD CONSTRAINT "CK_Booking_nights_sane" CHECK ("nights" >= 1 AND "nights" <= 30);
ALTER TABLE "Booking"
  ADD CONSTRAINT "CK_Booking_guests_sane" CHECK ("guests" >= 1 AND "guests" <= 20);
