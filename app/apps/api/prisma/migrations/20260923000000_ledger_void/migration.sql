-- Append-only ledger: rows that no longer stand are voided, never deleted.

ALTER TABLE "LedgerEntry" ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3);
ALTER TABLE "LedgerEntry" ADD COLUMN IF NOT EXISTS "voidReason" TEXT;
ALTER TABLE "LedgerEntry" ADD COLUMN IF NOT EXISTS "voidedById" TEXT;

-- The one-row-per-parent rule now means one *live* row per parent: a
-- voided row stays for the record without blocking its replacement (an
-- offset the guest changes is voided and written again).
DROP INDEX IF EXISTS "UX_LedgerEntry_bookingId";
CREATE UNIQUE INDEX "UX_LedgerEntry_bookingId"
  ON "LedgerEntry" ("bookingId")
  WHERE "bookingId" IS NOT NULL AND "voidedAt" IS NULL;

DROP INDEX IF EXISTS "UX_LedgerEntry_orderId";
CREATE UNIQUE INDEX "UX_LedgerEntry_orderId"
  ON "LedgerEntry" ("orderId")
  WHERE "orderId" IS NOT NULL AND "voidedAt" IS NULL;

DROP INDEX IF EXISTS "UX_LedgerEntry_offsetId";
CREATE UNIQUE INDEX "UX_LedgerEntry_offsetId"
  ON "LedgerEntry" ("offsetId")
  WHERE "offsetId" IS NOT NULL AND "voidedAt" IS NULL;
