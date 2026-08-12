-- CreateTable
CREATE TABLE "Phrase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ede" TEXT NOT NULL,
    "en" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "moderationStatus" TEXT NOT NULL DEFAULT 'IN_REVIEW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ArchiveEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meta" TEXT NOT NULL,
    "keeperBuon" TEXT NOT NULL,
    "body" TEXT,
    "pillar" TEXT,
    "moderationStatus" TEXT NOT NULL DEFAULT 'IN_REVIEW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contributedById" TEXT,
    "moderatedById" TEXT,
    "moderatedAt" DATETIME,
    "moderationNote" TEXT,
    CONSTRAINT "ArchiveEntry_contributedById_fkey" FOREIGN KEY ("contributedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ArchiveEntry_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ArchiveEntry" ("body", "createdAt", "id", "keeperBuon", "meta", "moderatedById", "moderationStatus", "title", "type") SELECT "body", "createdAt", "id", "keeperBuon", "meta", "moderatedById", "moderationStatus", "title", "type" FROM "ArchiveEntry";
DROP TABLE "ArchiveEntry";
ALTER TABLE "new_ArchiveEntry" RENAME TO "ArchiveEntry";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
