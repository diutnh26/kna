-- "SiteContent": the website's own prose from the frontend locale files.
-- "Governance": Committee membership, decisions, and Community Fund
-- allocations. Mirrors DOCUMENT_SOURCE_TYPES in src/lib/enums.ts — both,
-- or neither.
ALTER TABLE "KnowledgeDocument" DROP CONSTRAINT "CK_KnowledgeDocument_sourceType";
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "CK_KnowledgeDocument_sourceType"
  CHECK ("sourceType" IN ('KnowledgeCard', 'ArchiveEntry', 'Phrase', 'Listing', 'ReferenceDocument', 'Product', 'SiteContent', 'Governance'));
