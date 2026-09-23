-- "Product": a published marketplace product, embedded so the assistant
-- can answer questions about what the artisans sell. Mirrors the
-- DOCUMENT_SOURCE_TYPES list in src/lib/enums.ts — both, or neither.
ALTER TABLE "KnowledgeDocument" DROP CONSTRAINT "CK_KnowledgeDocument_sourceType";
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "CK_KnowledgeDocument_sourceType"
  CHECK ("sourceType" IN ('KnowledgeCard', 'ArchiveEntry', 'Phrase', 'Listing', 'ReferenceDocument', 'Product'));
