-- Carbon offsets, attached to the booking they belong to.
--
-- The offset screen has always said "offset contributions sit on the same
-- public ledger as bookings and purchases". Until now nothing on that
-- screen reached the database at all, so the sentence described an
-- intention. This makes it true.
--
-- No status column: an offset is paid with its booking and is exactly as
-- settled as the booking is. Deriving that from the parent avoids a second
-- copy of the truth, which is the mistake the ledger already had to unlearn
-- once.
CREATE TABLE "OffsetContribution" (
  "id"        TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "kgCo2e"    INTEGER NOT NULL,
  "amountVnd" INTEGER NOT NULL,
  "joining"   BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OffsetContribution_pkey" PRIMARY KEY ("id")
);

-- At most one per booking. Offsetting the same trip twice would double the
-- figure on the public ledger.
CREATE UNIQUE INDEX "OffsetContribution_bookingId_key" ON "OffsetContribution"("bookingId");

ALTER TABLE "OffsetContribution"
  ADD CONSTRAINT "OffsetContribution_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Same treatment as every other enum-shaped column here.
ALTER TABLE "OffsetContribution"
  ADD CONSTRAINT "CK_OffsetContribution_projectId"
  CHECK ("projectId" IN ('yokdon', 'lak', 'corridor'));

ALTER TABLE "OffsetContribution"
  ADD CONSTRAINT "CK_OffsetContribution_amounts"
  CHECK ("kgCo2e" >= 0 AND "amountVnd" >= 0);

-- The ledger can now describe an offset as well as a booking or an order.
ALTER TABLE "LedgerEntry" ADD COLUMN "offsetId" TEXT;

ALTER TABLE "LedgerEntry"
  ADD CONSTRAINT "LedgerEntry_offsetId_fkey"
  FOREIGN KEY ("offsetId") REFERENCES "OffsetContribution"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Filtered unique, matching the bookingId and orderId indexes: at most one
-- ledger row per offset, while still allowing many rows with a NULL offset.
CREATE UNIQUE INDEX "UX_LedgerEntry_offsetId"
  ON "LedgerEntry" ("offsetId")
  WHERE "offsetId" IS NOT NULL;
