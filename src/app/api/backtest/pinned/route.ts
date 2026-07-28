import { NextResponse } from 'next/server';
import { requireValidUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await requireValidUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const pinned = await prisma.pinnedStrategy.findMany({
      where: { userId: user.id },
      select: { 
        id: true,
        symbol: true, 
        strategyName: true,
        lastSignal: true,
        signalDate: true,
        isNewSignal: true,
        statsJson: true,
        lastUpdated: true
      }
    });

    return NextResponse.json({ success: true, pinned });
  } catch (error: any) {
    console.error('Error fetching pinned strategies:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireValidUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { symbol, strategy } = await request.json();
    if (!symbol || !strategy) return NextResponse.json({ error: 'Symbol and strategy required' }, { status: 400 });

    const existing = await prisma.pinnedStrategy.findUnique({
      where: {
        userId_symbol_strategyName: {
          userId: user.id,
          symbol,
          strategyName: strategy
        }
      }
    });

    if (existing) {
      // Unpin
      await prisma.pinnedStrategy.delete({
        where: { id: existing.id }
      });
      return NextResponse.json({ success: true, action: 'unpinned' });
    } else {
      // Pin
      await prisma.pinnedStrategy.create({
        data: {
          userId: user.id,
          symbol,
          strategyName: strategy
        }
      });
      return NextResponse.json({ success: true, action: 'pinned' });
    }
  } catch (error: any) {
    console.error('Error toggling pinned strategy:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
