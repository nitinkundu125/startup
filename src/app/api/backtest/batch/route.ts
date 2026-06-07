import { NextResponse } from 'next/server';
import { requireValidUser } from '@/lib/auth';
import { fetchYahooDailyCloses } from '@/lib/index-history';
import { runDynamicBacktest, StrategyParams } from '@/lib/dynamic-backtester';
import { MASTER_STRATEGY_LIBRARY } from '@/lib/strategy-library';

export type BatchOptimizerResult = {
  symbol: string;
  strategyName: string;
  totalTrades: number;
  profitableTrades: number;
  winRate: number;
  averageReturn: number;
  totalReturn: number;
  strategy: StrategyParams;
  currentSignal?: 'NEW_BUY' | 'NEW_SELL' | 'HOLDING' | 'WAITING';
};

export async function POST(request: Request) {
  const user = await requireValidUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { symbols } = await request.json();
    
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json({ error: 'No symbols provided' }, { status: 400 });
    }

    // Limit to max 50 symbols per batch
    const targetSymbols = symbols.slice(0, 50);
    const batchResults: BatchOptimizerResult[] = [];
    
    // Chunk size of 5 to avoid Yahoo rate limits
    const CHUNK_SIZE = 5;
    for (let i = 0; i < targetSymbols.length; i += CHUNK_SIZE) {
      const chunk = targetSymbols.slice(i, i + CHUNK_SIZE);
      
      const chunkPromises = chunk.map(async (symbol) => {
        try {
          const period1 = new Date('1990-01-01');
          const result = await fetchYahooDailyCloses(symbol, period1);
          if (result.length < 100) return null; // Not enough data
          
          const closes = result.map((r: any) => r.close);
          const highs = result.map((r: any) => r.high ?? r.close);
          const lows = result.map((r: any) => r.low ?? r.close);
          const volumes = result.map((r: any) => r.volume ?? 0);
          const dates = result.map((r: any) => new Date(r.date));
          
          const symbolResults: BatchOptimizerResult[] = [];
          
          for (const strat of MASTER_STRATEGY_LIBRARY) {
            const stats = runDynamicBacktest(strat, closes, highs, lows, volumes, dates);
            
            // Strict 70% win rate filter and minimum 3 trades
            if (stats.totalTrades >= 3 && stats.winRate >= 70) {
              symbolResults.push({
                symbol,
                strategyName: strat.type === 'COMPOUND' ? (strat.name || 'Custom Compound') : `Single ${strat.type}`,
                totalTrades: stats.totalTrades,
                profitableTrades: stats.profitableTrades,
                winRate: stats.winRate,
                averageReturn: stats.averageReturn,
                totalReturn: stats.totalReturn,
                strategy: strat,
                currentSignal: stats.currentSignal
              });
            }
          }
          return symbolResults;
        } catch (e) {
          console.error(`Failed to process ${symbol}:`, e);
          return null;
        }
      });
      
      const results = await Promise.all(chunkPromises);
      for (const res of results) {
        if (res) batchResults.push(...res);
      }
    }
    
    // Sort globally by highest winRate, then totalReturn
    batchResults.sort((a, b) => {
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.totalReturn - a.totalReturn;
    });

    // Return all successful combinations without arbitrary limit
    return NextResponse.json({ success: true, results: batchResults });
  } catch (error) {
    console.error('Batch Optimize Error:', error);
    return NextResponse.json({ error: 'Optimization failed' }, { status: 500 });
  }
}
