#!/bin/bash
# Nightly snapshot of the SQLite database. There was no backup schedule at all.
#
# `sqlite3 .backup` is the correct way to copy a live SQLite file — plain cp can
# capture a torn page mid-write. sqlite3 is not installed here, so this uses
# Prisma's bundled better-sqlite3-free approach: the VACUUM INTO statement,
# which is atomic and safe on a live database.
set -euo pipefail
DIR=/opt/backups/db
mkdir -p "$DIR"
STAMP=$(date -u +%Y%m%d-%H%M%S)
cd /opt/algo-engine
node -e "
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  p.\$executeRawUnsafe(\"VACUUM INTO '$DIR/dev.db.$STAMP'\")
    .then(() => p.\$disconnect())
    .catch(e => { console.error(e.message); process.exit(1); });
"
gzip -f "$DIR/dev.db.$STAMP"
# Keep 14 days. Retention exists so the disk cannot fill silently.
find "$DIR" -name 'dev.db.*.gz' -mtime +14 -delete
echo "$(date -u +%FT%TZ) backup ok: $DIR/dev.db.$STAMP.gz ($(stat -c%s "$DIR/dev.db.$STAMP.gz") bytes)"
