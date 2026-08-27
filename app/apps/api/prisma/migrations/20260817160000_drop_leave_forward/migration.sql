-- Two ways to contribute, not three.
--
-- LEAVE_FORWARD let a guest whose dates met no session "leave their place
-- for a later visitor". It read as a contribution while being the absence
-- of one, and it took the first slot on the screen whenever a guest was
-- not eligible — which, on the current fortnightly schedule, is most of
-- them. Joining in person is the offer; money is the alternative.
--
-- No rows to migrate: production holds only DONATE, and the seed clears
-- this table on every run.
ALTER TABLE "OffsetContribution" DROP CONSTRAINT "CK_OffsetContribution_mode";

ALTER TABLE "OffsetContribution"
  ADD CONSTRAINT "CK_OffsetContribution_mode"
  CHECK ("mode" IN ('IN_PERSON', 'DONATE'));
