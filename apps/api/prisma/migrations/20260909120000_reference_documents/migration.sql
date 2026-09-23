-- "ReferenceDocument": a chunk of a PDF/DOCX file from apps/api/data,
-- ingested by the knowledge-base sync alongside the moderated sources.
-- Mirrors the DOCUMENT_SOURCE_TYPES list in src/lib/enums.ts — both, or
-- neither, per the rule stated there.
ALTER TABLE "KnowledgeDocument" DROP CONSTRAINT "CK_KnowledgeDocument_sourceType";
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "CK_KnowledgeDocument_sourceType"
  CHECK ("sourceType" IN ('KnowledgeCard', 'ArchiveEntry', 'Phrase', 'Listing', 'ReferenceDocument'));
