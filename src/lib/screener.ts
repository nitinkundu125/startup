import { prisma } from '@/lib/prisma';
import { calculateSMA, calculateRSI, calculateMACD, calculateBollingerBands } from './indicators';
import { fetchYahooDailyCloses } from '@/lib/index-history';
import { runBacktest, formatBacktestMessage, StrategyType } from './backtester';

export async function runScreenerForSymbol(userId: string, symbol: string) {
  const period1 = new Date('1990-01-01'); // Fetch all available lifetime data

  let result;
  try {
    result = await fetchYahooDailyCloses(symbol, period1);
  } catch (error) {
    console.error(`Failed to fetch history for ${symbol}:`, error);
    return;
  }

  if (result.length < 200) {
    console.warn(`Not enough data for ${symbol} to compute 200 SMA.`);
    return;
  }

  const closes = result.map(r => r.close);
  const dates = result.map(r => new Date(r.date));

  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, 200);
  const rsi = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const bb = calculateBollingerBands(closes, 20, 2);

  // Run Backtests for all strategies to get paired events and stats
  const indicatorMap = { sma50, sma200, rsi, macd, bb };
  
  const smaResult = runBacktest('SMA', closes, dates, indicatorMap);
  const rsiResult = runBacktest('RSI', closes, dates, indicatorMap);
  const macdResult = runBacktest('MACD', closes, dates, indicatorMap);
  const bbResult = runBacktest('BB', closes, dates, indicatorMap);

  const backtestStats = {
    SMA: formatBacktestMessage(smaResult),
    RSI: formatBacktestMessage(rsiResult),
    MACD: formatBacktestMessage(macdResult),
    BB: formatBacktestMessage(bbResult)
  };

  const allRecentEvents = [
    ...smaResult.recentEvents.map(e => ({ ...e, statText: backtestStats.SMA })),
    ...rsiResult.recentEvents.map(e => ({ ...e, statText: backtestStats.RSI })),
    ...macdResult.recentEvents.map(e => ({ ...e, statText: backtestStats.MACD })),
    ...bbResult.recentEvents.map(e => ({ ...e, statText: backtestStats.BB }))
  ];

  // Clear out old random signals for this symbol so the feed is perfectly paired
  await prisma.screenerSignal.deleteMany({
    where: { userId, symbol }
  });

  // Save the newly simulated stateful paired signals to DB
  for (const event of allRecentEvents) {
    const fullDescription = `${event.description}\n${event.statText}`;

    await prisma.screenerSignal.create({
      data: {
        userId,
        symbol,
        type: event.type,
        rule: event.rule,
        price: event.price,
        date: event.date,
        description: fullDescription,
      }
    });
  }
}
