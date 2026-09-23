-- The travel assistant: its corpus, its embeddings, and the way the
-- community corrects it.
--
-- Note what is *not* here: `CREATE EXTENSION vector`. Embeddings live in a
-- BYTEA column as raw little-endian float32 and are compared in the
-- application. The reasoning is in src/ai/vector.ts; the short version is
-- that a few hundred short cards are searched exactly in well under a
-- millisecond, and pgvector is present on Neon but absent from both the
-- postgres:17 image CI runs and the portable Windows build that
-- apps/api/README.md documents for development. An extension that exists
-- in production and nowhere else is the development/production divergence
-- the "One engine everywhere" section of that README was written about.

-- ── The corpus ───────────────────────────────────────────────────────
--
-- Bilingual in one row. The Committee reviews one thing; approving the
-- Vietnamese and leaving the English unreviewed is exactly the gap this
-- table exists to close, so neither language is nullable.
CREATE TABLE "KnowledgeCard" (
  "id"               TEXT NOT NULL,
  "topic"            TEXT NOT NULL,
  "question"         TEXT NOT NULL,
  "questionVi"       TEXT NOT NULL,
  "answer"           TEXT NOT NULL,
  "answerVi"         TEXT NOT NULL,
  "href"             TEXT,
  "attributedTo"     TEXT,
  "sortOrder"        INTEGER NOT NULL DEFAULT 0,
  "moderationStatus" TEXT NOT NULL DEFAULT 'IN_REVIEW',
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "contributedById"  TEXT,
  "moderatedById"    TEXT,
  "moderatedAt"      TIMESTAMP(3),
  "moderationNote"   TEXT,
  CONSTRAINT "KnowledgeCard_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "KnowledgeCard"
  ADD CONSTRAINT "KnowledgeCard_contributedById_fkey"
  FOREIGN KEY ("contributedById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "KnowledgeCard"
  ADD CONSTRAINT "KnowledgeCard_moderatedById_fkey"
  FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "KnowledgeCard" ADD CONSTRAINT "CK_KnowledgeCard_moderationStatus"
  CHECK ("moderationStatus" IN ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'REJECTED'));

ALTER TABLE "KnowledgeCard" ADD CONSTRAINT "CK_KnowledgeCard_topic"
  CHECK ("topic" IN ('etiquette', 'culture', 'language', 'logistics', 'platform'));

-- The published set, grouped, is every read this table gets from the
-- assistant and from Explore.
CREATE INDEX "KnowledgeCard_moderationStatus_topic_idx"
  ON "KnowledgeCard"("moderationStatus", "topic");

-- ── Embeddings ───────────────────────────────────────────────────────
--
-- Every row here is *derived*. It can be reproduced from a KnowledgeCard,
-- ArchiveEntry, Phrase or Listing by re-running the sync, which is what
-- makes it safe for the sync to delete anything whose source is no longer
-- published. That reconciliation is the mechanism behind "it cites, or it
-- declines": withdrawn content stops being retrievable because the row
-- stops existing.
CREATE TABLE "KnowledgeDocument" (
  "id"         TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId"   TEXT NOT NULL,
  "locale"     TEXT NOT NULL,
  "kind"       TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "content"    TEXT NOT NULL,
  "metadata"   JSONB NOT NULL DEFAULT '{}',
  "href"       TEXT,
  -- Raw little-endian float32, unit length. 1024 dims × 4 bytes = 4 KB,
  -- so a thousand documents is 4 MB — well inside Neon's free 0.5 GB.
  "embedding"  BYTEA NOT NULL,
  -- Which model produced the vector, and how wide it is. Cosine between
  -- two different embedding spaces returns a number, just not a meaningful
  -- one, so retrieval filters on these rather than trusting that whoever
  -- changed AI_EMBED_MODEL remembered to re-run the sync.
  "model"      TEXT NOT NULL,
  "dim"        INTEGER NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- No foreign key to the four source tables: `sourceId` points into
-- whichever one `sourceType` names, and SQL cannot express that. The
-- reconciling sync is what keeps it honest, and it is tested.
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "CK_KnowledgeDocument_sourceType"
  CHECK ("sourceType" IN ('KnowledgeCard', 'ArchiveEntry', 'Phrase', 'Listing'));

ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "CK_KnowledgeDocument_kind"
  CHECK ("kind" IN ('QUESTION', 'PASSAGE'));

ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "CK_KnowledgeDocument_locale"
  CHECK ("locale" IN ('en', 'vi'));

-- What makes the sync an upsert rather than a delete-and-hope.
CREATE UNIQUE INDEX "KnowledgeDocument_source_locale_kind_key"
  ON "KnowledgeDocument"("sourceType", "sourceId", "locale", "kind");

CREATE INDEX "KnowledgeDocument_locale_kind_idx"
  ON "KnowledgeDocument"("locale", "kind");

-- ── Corrections ──────────────────────────────────────────────────────
--
-- Guardrail four, in the copy that already ships: "the community can
-- correct it — corrections go into the archive, not into a private model."
-- This is where that becomes a queue somebody works through.
--
-- The question and answer are copied in rather than referenced. The card
-- behind an answer is going to be edited — that is the point of flagging
-- it — and a report that mutates into agreeing with the fix records
-- nothing.
CREATE TABLE "AssistantFlag" (
  "id"             TEXT NOT NULL,
  "question"       TEXT NOT NULL,
  "answer"         TEXT NOT NULL,
  "tier"           TEXT NOT NULL,
  "sourceIds"      JSONB NOT NULL DEFAULT '[]',
  "reason"         TEXT,
  -- Nullable on purpose. A visitor who has not signed in is exactly the
  -- person most likely to be told something wrong, and requiring an
  -- account to report it filters out the reports worth having.
  "reportedById"   TEXT,
  "status"         TEXT NOT NULL DEFAULT 'OPEN',
  "resolvedById"   TEXT,
  "resolvedAt"     TIMESTAMP(3),
  "resolutionNote" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantFlag_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AssistantFlag"
  ADD CONSTRAINT "AssistantFlag_reportedById_fkey"
  FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "AssistantFlag"
  ADD CONSTRAINT "AssistantFlag_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "AssistantFlag" ADD CONSTRAINT "CK_AssistantFlag_tier"
  CHECK ("tier" IN ('A', 'B', 'C'));

ALTER TABLE "AssistantFlag" ADD CONSTRAINT "CK_AssistantFlag_status"
  CHECK ("status" IN ('OPEN', 'ACTIONED', 'DISMISSED'));

-- A report that is never looked at is the whole complaint about feedback
-- forms, so the queue is read oldest-open-first.
CREATE INDEX "AssistantFlag_status_createdAt_idx"
  ON "AssistantFlag"("status", "createdAt");

-- ── The bell learns one more sentence ────────────────────────────────
--
-- The Committee should not have to poll the flag queue to find out a
-- visitor reported an answer — the same reasoning as every other
-- *_AWAITING_* type. The CHECK is recreated rather than patched because
-- Postgres has no ALTER CONSTRAINT for CHECK bodies.
ALTER TABLE "Notification" DROP CONSTRAINT "CK_Notification_type";
ALTER TABLE "Notification" ADD CONSTRAINT "CK_Notification_type"
  CHECK ("type" IN (
    -- to the guest
    'BOOKING_CONFIRMED', 'BOOKING_DECLINED', 'ORDER_SETTLED', 'ORDER_CANCELLED',
    'ARCHIVE_PUBLISHED', 'ARCHIVE_REJECTED',
    -- to the household whose listing was booked
    'BOOKING_RECEIVED',
    -- to whoever has to act
    'BOOKING_AWAITING_DECISION', 'ORDER_AWAITING_SETTLEMENT', 'ARCHIVE_AWAITING_REVIEW',
    'ASSISTANT_FLAGGED'
  ));
