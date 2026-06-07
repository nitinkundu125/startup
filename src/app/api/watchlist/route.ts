import { NextResponse } from 'next/server';
import { requireValidUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  const user = await requireValidUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { symbol } = await request.json();
    if (!symbol) return NextResponse.json({ error: 'Symbol required' }, { status: 400 });

    const upperSymbol = symbol.toUpperCase().trim();

    await prisma.watchlistItem.create({
      data: {
        userId: user.id,
        symbol: upperSymbol
      }
    });

    revalidatePath('/watchlist');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Symbol already in watchlist' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await requireValidUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { symbol } = await request.json();
    if (!symbol) return NextResponse.json({ error: 'Symbol required' }, { status: 400 });

    const upperSymbol = symbol.toUpperCase().trim();

    await prisma.watchlistItem.delete({
      where: {
        userId_symbol: {
          userId: user.id,
          symbol: upperSymbol
        }
      }
    });

    // Also delete associated signals
    await prisma.screenerSignal.deleteMany({
      where: {
        userId: user.id,
        symbol: upperSymbol
      }
    });

    revalidatePath('/watchlist');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
