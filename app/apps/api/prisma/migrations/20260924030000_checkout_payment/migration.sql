-- Payment at check-out: the pay_booking signature and reminder progress,
-- dKNA top-ups, and the notifications that go with them.

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "payTx" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "reminderStage" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "TopUp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "amountVnd" INTEGER NOT NULL,
    "paymentRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "mintTx" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    CONSTRAINT "TopUp_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CK_TopUp_source" CHECK ("source" IN ('VIETQR', 'FAUCET')),
    CONSTRAINT "CK_TopUp_status" CHECK ("status" IN ('AWAITING_PAYMENT', 'PAID', 'CREDITED', 'FAILED')),
    CONSTRAINT "CK_TopUp_amount" CHECK ("amountVnd" > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "TopUp_paymentRef_key" ON "TopUp"("paymentRef");
CREATE INDEX IF NOT EXISTS "TopUp_userId_createdAt_idx" ON "TopUp"("userId", "createdAt");
ALTER TABLE "TopUp" ADD CONSTRAINT "TopUp_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "CK_Notification_type";
ALTER TABLE "Notification"
  ADD CONSTRAINT "CK_Notification_type"
  CHECK ("type" IN (
    -- to the guest
    'BOOKING_CONFIRMED', 'BOOKING_DECLINED', 'ORDER_SETTLED', 'ORDER_CANCELLED',
    'ARCHIVE_PUBLISHED', 'ARCHIVE_REJECTED',
    'PAYMENT_DUE', 'PAYMENT_OVERDUE', 'BOOKING_PAID', 'TOPUP_CREDITED',
    -- to the guest, the household and coordinators
    'BOOKING_UNPAID',
    -- to the household whose listing was booked
    'BOOKING_RECEIVED',
    -- to whoever has to act
    'BOOKING_AWAITING_DECISION', 'ORDER_AWAITING_SETTLEMENT', 'ARCHIVE_AWAITING_REVIEW'
  ));
