-- VietQR payment tracking + demo token disbursement signatures

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "paymentRef" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT';
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "paymentPaidAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "demoTxSigs" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "demoDisburseAt" TIMESTAMP(3);

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentRef" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentPaidAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Booking_paymentRef_idx" ON "Booking"("paymentRef");
CREATE INDEX IF NOT EXISTS "Order_paymentRef_idx" ON "Order"("paymentRef");
