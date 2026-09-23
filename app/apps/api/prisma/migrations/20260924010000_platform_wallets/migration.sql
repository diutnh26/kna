-- One platform-held wallet per account (key encrypted at rest), and the
-- option to pay from a linked Phantom wallet instead.

CREATE TABLE IF NOT EXISTS "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pubkey" TEXT NOT NULL,
    "encryptedSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registeredTx" TEXT,
    "registeredAt" TIMESTAMP(3),
    "registerError" TEXT,
    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Wallet_userId_key" ON "Wallet"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Wallet_pubkey_key" ON "Wallet"("pubkey");

ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "WalletLink" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WalletLink" ADD COLUMN IF NOT EXISTS "paymentWalletTx" TEXT;
