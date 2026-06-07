export type BacktestResult = {
  totalTrades: number;
  profitableTrades: number;
  winRate: number; // 0 to 100
  averageReturn: number; // Percentage
  recentEvents: TradeEvent[]; // Events in the last 90 days
};

export type TradeEvent = {
  type: 'BUY' | 'SELL';
  rule: string;
  price: number;
  date: Date;
  description: string;
};

export type StrategyType = 'SMA' | 'RSI' | 'MACD' | 'BB';

export function runBacktest(
  strategy: StrategyType,
  closes: number[],
  dates: Date[],
  indicators: any,
  stopLossPercent = 0.05
): BacktestResult {
  let inTrade = false;
  let entryPrice = 0;
  
  const trades: { returnPct: number }[] = [];
  const recentEvents: TradeEvent[] = [];

  // 90 days ago timestamp
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  for (let i = 1; i < closes.length; i++) {
    const price = closes[i];
    const prevPrice = closes[i - 1];
    const date = dates[i];

    if (!inTrade) {
      // Check Entry Conditions
      let buySignal = false;
      let rule = '';
      let description = '';
      
      if (strategy === 'SMA') {
        const { sma50, sma200 } = indicators;
        if (sma50[i] > sma200[i] && sma50[i - 1] <= sma200[i - 1]) {
          buySignal = true; rule = 'SMA_GOLDEN_CROSS'; description = '50-day SMA crossed above 200-day SMA.';
        }
      } 
      else if (strategy === 'RSI') {
        const { rsi } = indicators;
        if (rsi[i] < 30 && rsi[i - 1] >= 30) {
          buySignal = true; rule = 'RSI_OVERSOLD'; description = `RSI dropped into oversold territory (${rsi[i].toFixed(1)}).`;
        }
      }
      else if (strategy === 'MACD') {
        const { macdLine, signalLine } = indicators.macd;
        if (macdLine[i] > signalLine[i] && macdLine[i - 1] <= signalLine[i - 1]) {
          buySignal = true; rule = 'MACD_BULLISH'; description = 'MACD line crossed above Signal line.';
        }
      }
      else if (strategy === 'BB') {
        const { lower } = indicators.bb;
        if (price < lower[i] && prevPrice >= lower[i - 1]) {
          buySignal = true; rule = 'BB_LOWER_BREAKOUT'; description = 'Price closed below the lower Bollinger Band.';
        }
      }

      if (buySignal) {
        inTrade = true;
        entryPrice = price;

        if (date >= ninetyDaysAgo) {
          recentEvents.push({ type: 'BUY', rule, price, date, description });
        }
      }
    } 
    else {
      // Check Exit Conditions
      let sellSignal = false;
      let rule = '';
      let description = '';
      const currentLoss = (entryPrice - price) / entryPrice;
      
      // Fixed Stop Loss
      if (currentLoss >= stopLossPercent) {
        sellSignal = true;
        rule = 'STOP_LOSS';
        description = `Price dropped 5% below entry price.`;
      } 
      else {
        // Indicator Exits
        if (strategy === 'SMA') {
          const { sma50, sma200 } = indicators;
          if (sma50[i] < sma200[i] && sma50[i - 1] >= sma200[i - 1]) {
            sellSignal = true; rule = 'SMA_DEATH_CROSS'; description = '50-day SMA crossed below 200-day SMA.';
          }
        } 
        else if (strategy === 'RSI') {
          const { rsi } = indicators;
          if (rsi[i] > 70 && rsi[i - 1] <= 70) {
            sellSignal = true; rule = 'RSI_OVERBOUGHT'; description = `RSI rose into overbought territory (${rsi[i].toFixed(1)}).`;
          }
        }
        else if (strategy === 'MACD') {
          const { macdLine, signalLine } = indicators.macd;
          if (macdLine[i] < signalLine[i] && macdLine[i - 1] >= signalLine[i - 1]) {
            sellSignal = true; rule = 'MACD_BEARISH'; description = 'MACD line crossed below Signal line.';
          }
        }
        else if (strategy === 'BB') {
          const { upper } = indicators.bb;
          if (price > upper[i] && prevPrice <= upper[i - 1]) {
            sellSignal = true; rule = 'BB_UPPER_BREAKOUT'; description = 'Price closed above the upper Bollinger Band.';
          }
        }
      }

      if (sellSignal) {
        inTrade = false;
        const returnPct = ((price - entryPrice) / entryPrice) * 100;
        trades.push({ returnPct });

        if (date >= ninetyDaysAgo) {
          recentEvents.push({ type: 'SELL', rule, price, date, description });
        }
      }
    }
  }

  if (trades.length === 0) {
    return { totalTrades: 0, profitableTrades: 0, winRate: 0, averageReturn: 0, recentEvents };
  }

  const profitableTrades = trades.filter(t => t.returnPct > 0).length;
  const winRate = (profitableTrades / trades.length) * 100;
  const avgReturn = trades.reduce((sum, t) => sum + t.returnPct, 0) / trades.length;

  return {
    totalTrades: trades.length,
    profitableTrades,
    winRate,
    averageReturn: avgReturn,
    recentEvents
  };
}

export function formatBacktestMessage(result: BacktestResult): string {
  if (result.totalTrades === 0) return "Not enough historical data to backtest.";
  return `Historical Edge: This setup occurred ${result.totalTrades} times over the stock's lifetime. ${result.profitableTrades} trades were profitable (${result.winRate.toFixed(0)}% Win Rate) with an average return of ${result.averageReturn > 0 ? '+' : ''}${result.averageReturn.toFixed(1)}% per trade.`;
}
