-- At most one ledger entry per booking, and per order.
--
-- Expressed as partial unique indexes rather than a plain UNIQUE. Postgres
-- treats NULLs as distinct, so plain UNIQUE would in fact be correct here —
-- but SQL Server treats them as equal, where it silently permitted only one
-- row with a NULL bookingId and would have failed the second marketplace
-- order. Keeping the partial form means this constraint means the same thing
-- on either engine.
CREATE UNIQUE INDEX "UX_LedgerEntry_bookingId"
  ON "LedgerEntry" ("bookingId")
  WHERE "bookingId" IS NOT NULL;

CREATE UNIQUE INDEX "UX_LedgerEntry_orderId"
  ON "LedgerEntry" ("orderId")
  WHERE "orderId" IS NOT NULL;
