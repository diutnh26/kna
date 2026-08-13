BEGIN TRY

BEGIN TRAN;

-- DropIndex
ALTER TABLE [dbo].[LedgerEntry] DROP CONSTRAINT [LedgerEntry_bookingId_key];

-- DropIndex
ALTER TABLE [dbo].[LedgerEntry] DROP CONSTRAINT [LedgerEntry_orderId_key];


-- Re-add the uniqueness Prisma dropped, but filtered.
--
-- A plain UNIQUE on a nullable column is wrong here: SQL Server treats
-- NULLs as equal, so it would permit exactly one row with bookingId NULL —
-- i.e. exactly one order-derived ledger entry, ever. Filtering to
-- non-NULL values enforces what is actually meant: at most one ledger
-- entry per booking, and at most one per order.
CREATE UNIQUE INDEX [UX_LedgerEntry_bookingId]
  ON [dbo].[LedgerEntry] ([bookingId])
  WHERE [bookingId] IS NOT NULL;

CREATE UNIQUE INDEX [UX_LedgerEntry_orderId]
  ON [dbo].[LedgerEntry] ([orderId])
  WHERE [orderId] IS NOT NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
