-- Sessions run over several days, and a guest who misses one can book the next.
--
-- A planting is a long weekend, not an afternoon, so a stay overlaps a
-- session or it does not — a single date could not express that. And a
-- guest whose dates miss every session had only one thing left to offer,
-- money, which is not the same as being unable to help.
ALTER TABLE "OffsetContribution" DROP CONSTRAINT "CK_OffsetContribution_mode";

ALTER TABLE "OffsetContribution"
  ADD CONSTRAINT "CK_OffsetContribution_mode"
  CHECK ("mode" IN ('IN_PERSON', 'NEXT_SESSION', 'DONATE'));

-- Which session was committed to. Stored rather than recomputed: a guest
-- told "5-7 September" should still read that a year later, even if the
-- anchor or the interval move in the meantime.
ALTER TABLE "OffsetContribution" ADD COLUMN "sessionStart" DATE;
ALTER TABLE "OffsetContribution" ADD COLUMN "sessionEnd" DATE;

-- Turning up carries a session; money does not.
ALTER TABLE "OffsetContribution"
  ADD CONSTRAINT "CK_OffsetContribution_session_matches_mode"
  CHECK (
    ("mode" = 'DONATE' AND "sessionStart" IS NULL AND "sessionEnd" IS NULL)
    OR ("mode" <> 'DONATE' AND "sessionStart" IS NOT NULL AND "sessionEnd" IS NOT NULL
        AND "sessionEnd" >= "sessionStart")
  );
