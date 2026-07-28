-- CreateTable
CREATE TABLE "ScanCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "results" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PinnedStrategy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "strategyName" TEXT NOT NULL,
    "pinnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSignal" TEXT,
    "signalDate" DATETIME,
    "isNewSignal" BOOLEAN NOT NULL DEFAULT false,
    "statsJson" TEXT,
    "lastUpdated" DATETIME,
    CONSTRAINT "PinnedStrategy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PinnedStrategy" ("id", "pinnedAt", "strategyName", "symbol", "userId") SELECT "id", "pinnedAt", "strategyName", "symbol", "userId" FROM "PinnedStrategy";
DROP TABLE "PinnedStrategy";
ALTER TABLE "new_PinnedStrategy" RENAME TO "PinnedStrategy";
CREATE UNIQUE INDEX "PinnedStrategy_userId_symbol_strategyName_key" ON "PinnedStrategy"("userId", "symbol", "strategyName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ScanCache_symbol_dateKey_key" ON "ScanCache"("symbol", "dateKey");

