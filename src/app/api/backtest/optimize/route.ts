import { NextResponse } from 'next/server';
import { requireValidUser } from '@/lib/auth';
import { runOptimizer } from '@/lib/optimizer';

export async function POST(request: Request) {
  const user = await requireValidUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { symbol } = await request.json();
    if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });

    const results = await runOptimizer(symbol);
    
    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Optimizer Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
