-- CreateTable
CREATE TABLE "CorporateAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "exDate" DATETIME NOT NULL,
    "actionType" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "ratioNum" REAL,
    "ratioDen" REAL,
    "shareMultiplier" REAL,
    "dividendAmount" REAL,
    "source" TEXT NOT NULL DEFAULT 'NSE',
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "holdingsSnapshot" TEXT,
    "ltpSnapshot" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PinnedStrategy" (
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

-- CreateTable
CREATE TABLE "ImportFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "imported" INTEGER NOT NULL,
    "skipped" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "isin" TEXT,
    "symbolAliases" TEXT NOT NULL DEFAULT '[]',
    "name" TEXT NOT NULL,
    "price" REAL NOT NULL DEFAULT 0.0,
    "assetClass" TEXT NOT NULL DEFAULT 'STOCK',
    "benchmarkId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "price" REAL NOT NULL,
    "splitRatio" REAL,
    "date" DATETIME NOT NULL,
    "exchange" TEXT,
    "segment" TEXT,
    "series" TEXT,
    "auction" BOOLEAN NOT NULL DEFAULT false,
    "tradeId" TEXT,
    "orderId" TEXT,
    "orderExecutionTime" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScreenerSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScreenerSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScanCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "results" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "CorporateAction_symbol_exDate_idx" ON "CorporateAction"("symbol", "exDate");

-- CreateIndex
CREATE UNIQUE INDEX "CorporateAction_symbol_actionType_subject_key" ON "CorporateAction"("symbol", "actionType", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PinnedStrategy_userId_symbol_strategyName_key" ON "PinnedStrategy"("userId", "symbol", "strategyName");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_userId_canonicalKey_key" ON "Asset"("userId", "canonicalKey");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_userId_tradeId_key" ON "Transaction"("userId", "tradeId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_userId_symbol_key" ON "WatchlistItem"("userId", "symbol");

-- CreateIndex
CREATE INDEX "ScreenerSignal_userId_symbol_date_idx" ON "ScreenerSignal"("userId", "symbol", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ScanCache_symbol_dateKey_key" ON "ScanCache"("symbol", "dateKey");

