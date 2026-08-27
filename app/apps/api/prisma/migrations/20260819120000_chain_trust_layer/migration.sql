-- Track 2: Solana trust layer models

CREATE TABLE "WalletLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pubkey" TEXT NOT NULL,
    "challengeNonce" TEXT,
    "challengeExpiry" TIMESTAMP(3),
    "linkVersion" INTEGER NOT NULL DEFAULT 1,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChainOutbox" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChainOutbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LedgerAttestation" (
    "id" TEXT NOT NULL,
    "ledgerEntryId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "pendingPda" TEXT,
    "finalPda" TEXT,
    "pendingTxSig" TEXT,
    "finalizeTxSig" TEXT,
    "slot" BIGINT,
    "state" TEXT NOT NULL DEFAULT 'PENDING_SIGNATURE',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LedgerAttestation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChainEntityRef" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "pdaAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archiveEntryId" TEXT,
    CONSTRAINT "ChainEntityRef_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WalletLink_userId_key" ON "WalletLink"("userId");
CREATE UNIQUE INDEX "WalletLink_pubkey_key" ON "WalletLink"("pubkey");
CREATE UNIQUE INDEX "ChainOutbox_idempotencyKey_key" ON "ChainOutbox"("idempotencyKey");
CREATE INDEX "ChainOutbox_status_leaseUntil_idx" ON "ChainOutbox"("status", "leaseUntil");
CREATE UNIQUE INDEX "LedgerAttestation_ledgerEntryId_key" ON "LedgerAttestation"("ledgerEntryId");
CREATE INDEX "LedgerAttestation_state_idx" ON "LedgerAttestation"("state");
CREATE UNIQUE INDEX "ChainEntityRef_entityType_entityId_key" ON "ChainEntityRef"("entityType", "entityId");
CREATE UNIQUE INDEX "ChainEntityRef_archiveEntryId_key" ON "ChainEntityRef"("archiveEntryId");

ALTER TABLE "WalletLink" ADD CONSTRAINT "WalletLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "LedgerAttestation" ADD CONSTRAINT "LedgerAttestation_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "ChainEntityRef" ADD CONSTRAINT "ChainEntityRef_archiveEntryId_fkey" FOREIGN KEY ("archiveEntryId") REFERENCES "ArchiveEntry"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
