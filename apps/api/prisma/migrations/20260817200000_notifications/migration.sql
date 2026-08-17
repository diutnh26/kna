-- Notifications, one row per reader.
--
-- A booking being confirmed is news to the guest and to the household, and
-- each gets their own row: they read at different times, and one marking it
-- read must not clear it for the other.
--
-- The text is not stored. `type` names an i18n key and `params` holds its
-- interpolation values, because this platform is bilingual and a person can
-- change language whenever they like — a sentence frozen in English at the
-- moment a coordinator pressed confirm would still be English a month later
-- on an otherwise Vietnamese screen.
CREATE TABLE "Notification" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "type"      TEXT NOT NULL,
  "params"    JSONB NOT NULL DEFAULT '{}',
  "href"      TEXT,
  "readAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "Notification"
  ADD CONSTRAINT "CK_Notification_type"
  CHECK ("type" IN (
    -- to the guest
    'BOOKING_CONFIRMED', 'BOOKING_DECLINED', 'ORDER_SETTLED', 'ORDER_CANCELLED',
    'ARCHIVE_PUBLISHED', 'ARCHIVE_REJECTED',
    -- to the household whose listing was booked
    'BOOKING_RECEIVED',
    -- to whoever has to act
    'BOOKING_AWAITING_DECISION', 'ORDER_AWAITING_SETTLEMENT', 'ARCHIVE_AWAITING_REVIEW'
  ));

-- Reading the unread count is the most frequent query on this table, and
-- the timeline is always scoped to one person.
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
