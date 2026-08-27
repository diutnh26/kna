-- Two ways to take part, not one.
--
-- Until now an offset was money, with a `joining` boolean alongside saying
-- whether the guest also intended to turn up. That could not express the
-- case this change is about: a guest who wants to work but whose dates do
-- not meet a session. Three states do not fit in a boolean, and the boolean
-- could never say *why* somebody was not joining.
--
-- No backfill: seed.ts clears OffsetContribution on every run and no pilot
-- data exists yet.
ALTER TABLE "OffsetContribution" DROP COLUMN "joining";

ALTER TABLE "OffsetContribution" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'DONATE';
ALTER TABLE "OffsetContribution" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'hcmc';

-- Defaults exist only so the columns can be added NOT NULL to a table that
-- may hold demonstration rows. Every insert supplies both.
ALTER TABLE "OffsetContribution" ALTER COLUMN "mode" DROP DEFAULT;
ALTER TABLE "OffsetContribution" ALTER COLUMN "origin" DROP DEFAULT;

ALTER TABLE "OffsetContribution"
  ADD CONSTRAINT "CK_OffsetContribution_mode"
  CHECK ("mode" IN ('IN_PERSON', 'LEAVE_FORWARD', 'DONATE'));

-- Must stay in step with ORIGINS in apps/web/src/components/CarbonTracker.jsx.
-- hcmc, hanoi and danang are domestic; asia and europe are not, and only
-- those two carry the adjusted donation share.
ALTER TABLE "OffsetContribution"
  ADD CONSTRAINT "CK_OffsetContribution_origin"
  CHECK ("origin" IN ('hcmc', 'hanoi', 'danang', 'asia', 'europe'));

-- Taking part in person or leaving a place forward costs nothing, so only
-- a donation may carry an amount.
ALTER TABLE "OffsetContribution"
  ADD CONSTRAINT "CK_OffsetContribution_amount_matches_mode"
  CHECK (("mode" = 'DONATE' AND "amountVnd" > 0) OR ("mode" <> 'DONATE' AND "amountVnd" = 0));
