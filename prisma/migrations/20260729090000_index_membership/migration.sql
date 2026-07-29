-- CreateTable
CREATE TABLE "IndexMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "indexId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "company" TEXT,
    "industry" TEXT,
    "firstSeen" DATETIME NOT NULL,
    "lastSeen" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "IndexSyncLog" (
    "indexId" TEXT NOT NULL PRIMARY KEY,
    "syncedAt" DATETIME NOT NULL,
    "count" INTEGER NOT NULL,
    "added" INTEGER NOT NULL DEFAULT 0,
    "removed" INTEGER NOT NULL DEFAULT 0,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT
);

-- CreateIndex
CREATE INDEX "IndexMembership_indexId_active_idx" ON "IndexMembership"("indexId", "active");

-- CreateIndex
CREATE INDEX "IndexMembership_indexId_lastSeen_idx" ON "IndexMembership"("indexId", "lastSeen");

-- CreateIndex
CREATE UNIQUE INDEX "IndexMembership_indexId_symbol_firstSeen_key" ON "IndexMembership"("indexId", "symbol", "firstSeen");

