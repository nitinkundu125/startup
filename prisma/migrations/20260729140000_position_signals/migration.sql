-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LabPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "strategyName" TEXT NOT NULL,
    "entryPrice" REAL NOT NULL,
    "quantity" REAL NOT NULL,
    "entryDate" DATETIME NOT NULL,
    "stopLossPrice" REAL,
    "exitPrice" REAL,
    "exitDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "lastSignal" TEXT,
    "signalDate" DATETIME,
    "isNewSignal" BOOLEAN NOT NULL DEFAULT false,
    "lastNotifiedSignal" TEXT,
    "statsJson" TEXT,
    "lastChecked" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LabPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LabPosition" ("createdAt", "entryDate", "entryPrice", "exitDate", "exitPrice", "id", "notes", "quantity", "status", "stopLossPrice", "strategyName", "symbol", "updatedAt", "userId") SELECT "createdAt", "entryDate", "entryPrice", "exitDate", "exitPrice", "id", "notes", "quantity", "status", "stopLossPrice", "strategyName", "symbol", "updatedAt", "userId" FROM "LabPosition";
DROP TABLE "LabPosition";
ALTER TABLE "new_LabPosition" RENAME TO "LabPosition";
CREATE INDEX "LabPosition_userId_status_idx" ON "LabPosition"("userId", "status");
CREATE INDEX "LabPosition_userId_symbol_idx" ON "LabPosition"("userId", "symbol");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

