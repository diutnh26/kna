-- Revoking authority took up to seven days to take effect.
--
-- The JWT carried `role` and lived seven days, and requireRole plus the
-- ADMIN/COORDINATOR fast paths trusted that claim rather than re-reading the
-- database. Demoting a coordinator left their existing token working until
-- it expired, and there was no revocation of any kind — so a leaked token
-- was valid for a week with nothing anyone could do about it.
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
