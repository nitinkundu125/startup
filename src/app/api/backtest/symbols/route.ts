import { NextResponse } from 'next/server';
import { requireValidUser } from '@/lib/auth';
import { getIndexSymbols, getSyncStatus, INDEX_SOURCES, type IndexId } from '@/lib/index-constituents';

/**
 * Resolve an index id to its current member symbols.
 *
 * The scanner used to import hardcoded arrays straight into the browser bundle,
 * which meant the universe could only change by editing a source file. It now
 * asks the server, which serves the synced list and falls back to those same
 * arrays when nothing has been synced yet.
 */
export async function GET(request: Request) {
  const user = await requireValidUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const index = new URL(request.url).searchParams.get('index') as IndexId | null;
  if (!index || !(index in INDEX_SOURCES)) {
    return NextResponse.json(
      { error: `Unknown index. Valid: ${Object.keys(INDEX_SOURCES).join(', ')}` },
      { status: 400 }
    );
  }

  const symbols = await getIndexSymbols(index);
  const status = (await getSyncStatus()).find((s) => s.indexId === index);

  return NextResponse.json({
    success: true,
    index,
    label: INDEX_SOURCES[index].label,
    symbols,
    count: symbols.length,
    // The UI should be able to say "this list has never been synced" rather
    // than presenting a stale hardcoded universe as current.
    source: status?.ok ? 'nse-sync' : 'builtin-fallback',
    syncedAt: status?.syncedAt ?? null,
    staleDays: status?.syncedAt
      ? Math.floor((Date.now() - status.syncedAt.getTime()) / 86400000)
      : null,
  });
}
