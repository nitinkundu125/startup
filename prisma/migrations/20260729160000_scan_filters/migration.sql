-- CreateTable
CREATE TABLE "ScanFilter" (
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

-- CreateIndex
CREATE INDEX "ScanFilter_userId_idx" ON "ScanFilter"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ScanFilter_userId_name_key" ON "ScanFilter"("userId", "name");

