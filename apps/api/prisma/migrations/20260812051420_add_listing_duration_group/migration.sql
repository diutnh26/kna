/*
  Warnings:

  - Added the required column `duration` to the `Listing` table without a default value. This is not possible if the table is not empty.
  - Added the required column `groupSize` to the `Listing` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Listing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "blurb" TEXT NOT NULL,
    "priceVnd" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "duration" TEXT NOT NULL DEFAULT '',
    "groupSize" TEXT NOT NULL DEFAULT '',
    "carbonRating" TEXT NOT NULL,
    "customs" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Listing_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Listing" ("blurb", "carbonRating", "category", "createdAt", "customs", "id", "priceVnd", "providerId", "published", "title", "unit") SELECT "blurb", "carbonRating", "category", "createdAt", "customs", "id", "priceVnd", "providerId", "published", "title", "unit" FROM "Listing";
DROP TABLE "Listing";
ALTER TABLE "new_Listing" RENAME TO "Listing";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Backfill the 3 rows seed.ts had already created before this migration
-- existed, matching the values seed.ts now seeds fresh installs with.
UPDATE "Listing" SET "duration" = '2 nights', "groupSize" = 'Up to 4 guests'
  WHERE "title" = 'Two nights in Amí H''Bia''s longhouse';
UPDATE "Listing" SET "duration" = '4 hours', "groupSize" = 'Up to 6 guests'
  WHERE "title" = 'Forest edge walk with Y Wik';
UPDATE "Listing" SET "duration" = '6 hours', "groupSize" = 'Up to 3 guests'
  WHERE "title" = 'Backstrap loom, one full panel';
