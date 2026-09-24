-- Admin console: disabled accounts, the admin audit trail, uploaded images,
-- Committee review of phrases, and admin notices.

-- A disabled account cannot sign in or use a session; its records stay.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "disabledAt" TIMESTAMP(3);

-- Phrases are reviewed by the Committee like archive entries, so they keep
-- who decided, when and why.
ALTER TABLE "Phrase" ADD COLUMN IF NOT EXISTS "moderatedById" TEXT;
ALTER TABLE "Phrase" ADD COLUMN IF NOT EXISTS "moderatedAt" TIMESTAMP(3);
ALTER TABLE "Phrase" ADD COLUMN IF NOT EXISTS "moderationNote" TEXT;

-- Every change made from the admin console: who, what, before/after, why.
CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "recordId" TEXT,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AdminAuditLog_resource_recordId_idx" ON "AdminAuditLog"("resource", "recordId");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_actorUserId_idx" ON "AdminAuditLog"("actorUserId");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- Photographs uploaded by providers and admins, served by the API.
CREATE TABLE IF NOT EXISTS "UploadedImage" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadedImage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CK_UploadedImage_type" CHECK ("contentType" IN ('image/jpeg', 'image/png', 'image/webp')),
    CONSTRAINT "CK_UploadedImage_size" CHECK ("size" > 0 AND "size" <= 3145728)
);
CREATE INDEX IF NOT EXISTS "UploadedImage_ownerUserId_idx" ON "UploadedImage"("ownerUserId");

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
    'BOOKING_AWAITING_DECISION', 'ORDER_AWAITING_SETTLEMENT', 'ARCHIVE_AWAITING_REVIEW',
    -- from a KNĂ admin
    'ADMIN_NOTICE'
  ));
