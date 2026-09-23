-- Tier "D": answered from the model's general knowledge because the
-- archive had nothing, labelled as such in the UI. Mirrors ANSWER_TIERS
-- in src/lib/enums.ts.
ALTER TABLE "AssistantFlag" DROP CONSTRAINT "CK_AssistantFlag_tier";
ALTER TABLE "AssistantFlag" ADD CONSTRAINT "CK_AssistantFlag_tier"
  CHECK ("tier" IN ('A', 'B', 'C', 'D'));

-- The assistant's own to-do list: every question the archive could not
-- answer, so the content team can see exactly what knowledge to add.
CREATE TABLE "AssistantGap" (
  "id"        TEXT NOT NULL,
  "question"  TEXT NOT NULL,
  "locale"    TEXT NOT NULL,
  "tier"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantGap_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AssistantGap" ADD CONSTRAINT "CK_AssistantGap_tier"
  CHECK ("tier" IN ('C', 'D'));

CREATE INDEX "AssistantGap_createdAt_idx" ON "AssistantGap"("createdAt");
