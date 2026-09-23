-- The escrow + settle_split design was replaced by pay_booking (payment at
-- check-out from the guest wallet) before it was ever used.

ALTER TABLE "LedgerAttestation" DROP COLUMN IF EXISTS "settleTxSig";
ALTER TABLE "LedgerAttestation" DROP COLUMN IF EXISTS "settledAt";
ALTER TABLE "LedgerAttestation" DROP COLUMN IF EXISTS "settleError";
