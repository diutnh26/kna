-- Coordinator withdrawal of a pending attestation (cancel_pending).

ALTER TABLE "LedgerAttestation" ADD COLUMN IF NOT EXISTS "cancelTxSig" TEXT;
ALTER TABLE "LedgerAttestation" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
