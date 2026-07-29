-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ScanFilter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minWinRate" REAL NOT NULL DEFAULT 0,
    "minTrades" INTEGER NOT NULL DEFAULT 0,
    "maxDrawdown" REAL NOT NULL DEFAULT 0,
    "oosMinWinRate" REAL NOT NULL DEFAULT 0,
    "oosMinTrades" INTEGER NOT NULL DEFAULT 0,
    "oosMaxDrawdown" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScanFilter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ScanFilter" ("createdAt", "id", "maxDrawdown", "minTrades", "minWinRate", "name", "oosMaxDrawdown", "oosMinTrades", "oosMinWinRate", "updatedAt", "userId") SELECT "createdAt", "id", "maxDrawdown", "minTrades", "minWinRate", "name", "oosMaxDrawdown", "oosMinTrades", "oosMinWinRate", "updatedAt", "userId" FROM "ScanFilter";
DROP TABLE "ScanFilter";
ALTER TABLE "new_ScanFilter" RENAME TO "ScanFilter";
CREATE INDEX "ScanFilter_userId_idx" ON "ScanFilter"("userId");
CREATE UNIQUE INDEX "ScanFilter_userId_name_key" ON "ScanFilter"("userId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
