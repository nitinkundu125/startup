import { NextResponse } from 'next/server';
import { requireValidUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

/** Close a position, or amend its stop. */
export async function PATCH(request: Request, { params }: Ctx) {
  const user = await requireValidUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Scope the lookup to this user — an id alone must never reach another
  // user's row.
  const existing = await prisma.labPosition.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: 'Position not found' }, { status: 404 });

  try {
    const { exitPrice, exitDate, stopLossPrice, notes } = await request.json();

    const data: Record<string, unknown> = {};

    if (exitPrice != null && exitPrice !== '') {
      const price = Number(exitPrice);
      if (!Number.isFinite(price) || price <= 0) {
        return NextResponse.json({ error: 'exitPrice must be a positive number' }, { status: 400 });
      }
      data.exitPrice = price;
      data.exitDate = exitDate ? new Date(exitDate) : new Date();
      data.status = 'CLOSED';
    }

    if (stopLossPrice !== undefined) {
      if (stopLossPrice === null || stopLossPrice === '') {
        data.stopLossPrice = null;
      } else {
        const stop = Number(stopLossPrice);
        if (!Number.isFinite(stop) || stop <= 0) {
          return NextResponse.json({ error: 'stopLossPrice must be positive' }, { status: 400 });
        }
        data.stopLossPrice = stop;
      }
    }

    if (notes !== undefined) data.notes = notes ? String(notes).slice(0, 500) : null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const position = await prisma.labPosition.update({ where: { id }, data });
    return NextResponse.json({ success: true, position });
  } catch (e) {
    console.error('Update position error:', e);
    return NextResponse.json({ error: 'Could not update position' }, { status: 500 });
  }
}

/** Delete a position outright — for entries recorded by mistake. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const user = await requireValidUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.labPosition.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: 'Position not found' }, { status: 404 });

  await prisma.labPosition.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
