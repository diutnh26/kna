-- AlterTable
ALTER TABLE "LedgerAttestation" ADD COLUMN IF NOT EXISTS "cluster" TEXT;
ALTER TABLE "LedgerAttestation" ADD COLUMN IF NOT EXISTS "programId" TEXT;
ALTER TABLE "LedgerAttestation" ADD COLUMN IF NOT EXISTS "payloadVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "LedgerAttestation" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChainAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "ledgerEntryId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChainAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChainAuditLog_ledgerEntryId_idx" ON "ChainAuditLog"("ledgerEntryId");
CREATE INDEX IF NOT EXISTS "ChainAuditLog_createdAt_idx" ON "ChainAuditLog"("createdAt");
