import { NextResponse } from 'next/server';
import { requireValidUser } from '@/lib/auth';

export async function GET(request: Request) {
  const user = await requireValidUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const res = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`);
    if (!res.ok) throw new Error('Search failed');
    const searchResult = await res.json();
    
    // Filter out non-Indian stocks if possible, or just prioritize .NS / .BO
    const quotes = (searchResult.quotes || []).filter((q: any) => 
      q.isYahooFinance === true && 
      (q.exchange === 'NSI' || q.exchange === 'BSE' || (q.symbol && (q.symbol.endsWith('.NS') || q.symbol.endsWith('.BO'))))
    ).map((q: any) => ({
      symbol: q.symbol,
      name: q.shortname || q.longname || q.symbol,
      exchange: q.exchDisp || q.exchange
    }));

    return NextResponse.json({ results: quotes });
  } catch (error) {
    console.error('Yahoo Finance Search Error:', error);
    return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
  }
}
