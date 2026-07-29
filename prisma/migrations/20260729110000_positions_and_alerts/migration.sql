-- AlterTable
ALTER TABLE "PinnedStrategy" ADD COLUMN "lastNotifiedSignal" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "telegramChatId" TEXT;

-- CreateTable
CREATE TABLE "LabPosition" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LabPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LabPosition_userId_status_idx" ON "LabPosition"("userId", "status");

-- CreateIndex
CREATE INDEX "LabPosition_userId_symbol_idx" ON "LabPosition"("userId", "symbol");

