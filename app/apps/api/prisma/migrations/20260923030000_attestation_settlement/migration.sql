-- settle_split: payout of a finalized attestation from the treasury escrow.

ALTER TABLE "LedgerAttestation" ADD COLUMN IF NOT EXISTS "settleTxSig" TEXT;
ALTER TABLE "LedgerAttestation" ADD COLUMN IF NOT EXISTS "settledAt" TIMESTAMP(3);
ALTER TABLE "LedgerAttestation" ADD COLUMN IF NOT EXISTS "settleError" TEXT;
