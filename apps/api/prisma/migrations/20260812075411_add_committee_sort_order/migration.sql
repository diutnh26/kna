-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CommitteeMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "buon" TEXT NOT NULL,
    "since" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CommitteeMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CommitteeMember" ("buon", "id", "role", "since", "userId") SELECT "buon", "id", "role", "since", "userId" FROM "CommitteeMember";
DROP TABLE "CommitteeMember";
ALTER TABLE "new_CommitteeMember" RENAME TO "CommitteeMember";
CREATE UNIQUE INDEX "CommitteeMember_userId_key" ON "CommitteeMember"("userId");
CREATE TABLE "new_Listing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "blurb" TEXT NOT NULL,
    "priceVnd" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "groupSize" TEXT NOT NULL,
    "carbonRating" TEXT NOT NULL,
    "customs" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Listing_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Listing" ("blurb", "carbonRating", "category", "createdAt", "customs", "duration", "groupSize", "id", "priceVnd", "providerId", "published", "title", "unit") SELECT "blurb", "carbonRating", "category", "createdAt", "customs", "duration", "groupSize", "id", "priceVnd", "providerId", "published", "title", "unit" FROM "Listing";
DROP TABLE "Listing";
ALTER TABLE "new_Listing" RENAME TO "Listing";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
