import { NextResponse } from 'next/server';
import { requireValidUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const user = await requireValidUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing strategy ID' }, { status: 400 });
    }

    // Acknowledge by setting isNewSignal to false
    await prisma.pinnedStrategy.update({
      where: { 
        id,
        userId: user.id // Ensure they own it
      },
      data: {
        isNewSignal: false
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to ack pinned strategy:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
