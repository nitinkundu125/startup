import { NextResponse } from 'next/server';
import { requireValidUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Named scan filters.
 *
 * Six numbers retyped before every scan is friction, and friction means people
 * scan with whatever was left over from last time rather than what they meant.
 */

const NUM_FIELDS = [
  'minWinRate', 'minTrades', 'maxDrawdown',
  'oosMinWinRate', 'oosMinTrades', 'oosMaxDrawdown',
  'topPerSymbol',
] as const;

/** Percentages cap at 100; trade counts do not. All clamp at 0 = disabled. */
function clean(body: Record<string, unknown>) {
  const out: Record<string, number> = {};
  for (const f of NUM_FIELDS) {
    const n = Number(body[f]);
    const hi = f === 'topPerSymbol' ? 1000 : f.toLowerCase().includes('trades') ? 10_000 : 100;
    out[f] = Number.isFinite(n) ? Math.min(hi, Math.max(0, n)) : 0;
  }
  out.minTrades = Math.round(out.minTrades);
  out.topPerSymbol = Math.round(out.topPerSymbol);
  out.oosMinTrades = Math.round(out.oosMinTrades);
  return out;
}

export async function GET() {
  const user = await requireValidUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const filters = await prisma.scanFilter.findMany({
    where: { userId: user.id },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({ success: true, filters });
}

/** Create, or overwrite by name — saving twice under one name updates it. */
export async function POST(request: Request) {
  const user = await requireValidUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const name = String(body.name ?? '').trim().slice(0, 60);
    if (!name) return NextResponse.json({ error: 'A name is required' }, { status: 400 });

    const values = clean(body);

    // A preset where everything is 0 filters nothing — saving it would look
    // like a saved filter and behave like none.
    const { topPerSymbol: _cap, ...floors } = values;
    if (Object.values(floors).every((v) => v === 0) && values.topPerSymbol === 0) {
      return NextResponse.json(
        { error: 'Set at least one value — a preset of all zeros filters nothing' },
        { status: 400 }
      );
    }

    const filter = await prisma.scanFilter.upsert({
      where: { userId_name: { userId: user.id, name } },
      update: values,
      create: { userId: user.id, name, ...values },
    });
    return NextResponse.json({ success: true, filter });
  } catch (e) {
    console.error('Save filter error:', e);
    return NextResponse.json({ error: 'Could not save filter' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await requireValidUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  // Scoped to the user so an id alone cannot reach someone else's preset.
  const existing = await prisma.scanFilter.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: 'Filter not found' }, { status: 404 });

  await prisma.scanFilter.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
