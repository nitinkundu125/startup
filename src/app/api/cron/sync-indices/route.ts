import { NextResponse } from 'next/server';
import { requireValidUser } from '@/lib/auth';
import { isCronRequest } from '@/lib/cron-auth';
import { syncAllIndices, syncIndex, getSyncStatus, INDEX_SOURCES, type IndexId } from '@/lib/index-constituents';

/**
 * Monthly index-constituent sync.
 *
 * NSE reconstitutes twice a year, but companies also leave through mergers and
 * delistings at any time, so monthly picks those up within weeks rather than
 * months. Each run extends the membership history, which is what will eventually
 * make point-in-time backtests possible.
 *
 * Schedule (1st of each month, 07:00):
 *   0 7 1 * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     http://172.16.245.84:3000/api/cron/sync-indices
 */
export async function POST(request: Request) {
  const cron = isCronRequest(request);
  const user = cron ? null : await requireValidUser();
  if (!cron && !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const only = url.searchParams.get('index') as IndexId | null;

    if (only && !(only in INDEX_SOURCES)) {
      return NextResponse.json(
        { error: `Unknown index "${only}". Valid: ${Object.keys(INDEX_SOURCES).join(', ')}` },
        { status: 400 }
      );
    }

    const results = only ? [await syncIndex(only)] : await syncAllIndices();
    const failed = results.filter((r) => !r.ok);

    return NextResponse.json(
      {
        // Not "success: true" when half of it failed — a sync that quietly
        // reports OK is how a stale universe goes unnoticed for months.
        success: failed.length === 0,
        results: results.map((r) => ({
          index: r.indexId,
          ok: r.ok,
          count: r.count,
          added: r.added,
          removed: r.removed,
          ...(r.error ? { error: r.error } : {}),
        })),
      },
      { status: failed.length === results.length ? 502 : 200 }
    );
  } catch (error) {
    console.error('Index sync error:', error);
    return NextResponse.json({ error: 'Index sync failed' }, { status: 500 });
  }
}

/** Last sync per index, so staleness is visible without reading logs. */
export async function GET() {
  const user = await requireValidUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const status = await getSyncStatus();
  const now = Date.now();
  return NextResponse.json({
    success: true,
    indices: status.map((s) => ({
      index: s.indexId,
      syncedAt: s.syncedAt,
      daysAgo: Math.floor((now - s.syncedAt.getTime()) / 86400000),
      count: s.count,
      added: s.added,
      removed: s.removed,
      ok: s.ok,
      error: s.error,
    })),
  });
}
