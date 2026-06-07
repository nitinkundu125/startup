import { StrategyParams, CompoundStrategyParams } from './dynamic-backtester';

export const MASTER_STRATEGY_LIBRARY: StrategyParams[] = [];

// Helper to create named compound strategies
function createNamedStrategy(name: string, conditions: any[]): CompoundStrategyParams {
  return { type: 'COMPOUND', name, conditions };
}

// ----------------------------------------------------------------------------------
// 1. SINGLE CLASSICS
// ----------------------------------------------------------------------------------

// RSI Single Reversions
[10, 14, 21].forEach(period => {
  [20, 25, 30].forEach(oversold => {
    MASTER_STRATEGY_LIBRARY.push(createNamedStrategy(
      `Pure RSI Reversion (${period})`,
      [{ type: 'RSI', period, oversold, overbought: 100 - oversold }]
    ));
  });
});

// SMA & EMA Single Crossovers
const smaPairs = [[10, 50], [20, 50], [50, 200]];
smaPairs.forEach(([fast, slow]) => {
  MASTER_STRATEGY_LIBRARY.push(createNamedStrategy(
    fast === 50 && slow === 200 ? `The Golden Cross` : `SMA Trend Crossover (${fast}/${slow})`,
    [{ type: 'SMA', fastPeriod: fast, slowPeriod: slow }]
  ));
  MASTER_STRATEGY_LIBRARY.push(createNamedStrategy(
    `EMA Fast Trend Crossover (${fast}/${slow})`,
    [{ type: 'EMA', fastPeriod: fast, slowPeriod: slow }]
  ));
});

// MACD Single Momentum
[[8, 21], [12, 26]].forEach(([fast, slow]) => {
  MASTER_STRATEGY_LIBRARY.push(createNamedStrategy(
    `MACD Momentum Crossover (${fast}/${slow})`,
    [{ type: 'MACD', fastPeriod: fast, slowPeriod: slow, signalPeriod: 9 }]
  ));
});

// BB Single Breakouts
[20].forEach(period => {
  [2, 2.5].forEach(mult => {
    MASTER_STRATEGY_LIBRARY.push(createNamedStrategy(
      `Bollinger Breakout (${period}, ${mult})`,
      [{ type: 'BB', period, multiplier: mult }]
    ));
  });
});

// Stochastic Single Reversions
[14, 21].forEach(period => {
  [20, 30].forEach(oversold => {
    MASTER_STRATEGY_LIBRARY.push(createNamedStrategy(
      `Stochastic Reversion (${period})`,
      [{ type: 'STOCH', period, smoothK: 3, smoothD: 3, oversold, overbought: 100 - oversold }]
    ));
  });
});

// CCI Single Cyclical Turns
[20, 40].forEach(period => {
  MASTER_STRATEGY_LIBRARY.push(createNamedStrategy(
    `CCI Deep Reversion (${period})`,
    [{ type: 'CCI', period, oversold: -200, overbought: 200 }]
  ));
});

// Ichimoku Cloud Breakouts
MASTER_STRATEGY_LIBRARY.push(createNamedStrategy(
  `Ichimoku Kumo Breakout`,
  [{ type: 'ICHIMOKU', tenkan: 9, kijun: 26, senkouB: 52 }]
));

// ----------------------------------------------------------------------------------
// 2. DOUBLE COMBOS
// ----------------------------------------------------------------------------------

// EMA + VWAP (Institutional Trend Pullback)
MASTER_STRATEGY_LIBRARY.push(createNamedStrategy(
  `Institutional Value Buy (VWAP + EMA 20/50)`,
  [
    { type: 'EMA', fastPeriod: 20, slowPeriod: 50 }, // In an uptrend
    { type: 'VWAP', period: 20 } // Price dips below VWAP for value
  ]
));

// ADX + SMA (Confirmed Strong Trend)
MASTER_STRATEGY_LIBRARY.push(createNamedStrategy(
  `Strong Trend Rider (ADX > 25 + SMA 50/200)`,
  [
    { type: 'ADX', period: 14, strongThreshold: 25 },
    { type: 'SMA', fastPeriod: 50, slowPeriod: 200 }
  ]
));

// OBV + Breakout (Volume Confirmed Breakout)
MASTER_STRATEGY_LIBRARY.push(createNamedStrategy(
  `Volume Confirmed Breakout (BB + OBV Surge)`,
  [
    { type: 'BB', period: 20, multiplier: 2 },
    { type: 'OBV', period: 20 }
  ]
));

// SMA + RSI (The Pullback Buyer)
smaPairs.forEach(([fast, slow]) => {
  [14].forEach(rsiPeriod => {
    [30, 40].forEach(rsiOversold => {
      MASTER_STRATEGY_LIBRARY.push(createNamedStrategy(
        `The Pullback Buyer (SMA ${fast}/${slow} + RSI ${rsiPeriod})`,
        [
          { type: 'SMA', fastPeriod: fast, slowPeriod: slow },
          { type: 'RSI', period: rsiPeriod, oversold: rsiOversold, overbought: 70 }
        ]
      ));
    });
  });
});

// MACD + RSI (Momentum Reversal)
[[12, 26]].forEach(([fast, slow]) => {
  [14].forEach(rsiPeriod => {
    [30, 40].forEach(rsiOversold => {
      MASTER_STRATEGY_LIBRARY.push(createNamedStrategy(
        `Momentum Reversal (MACD + RSI)`,
        [
          { type: 'MACD', fastPeriod: fast, slowPeriod: slow, signalPeriod: 9 },
          { type: 'RSI', period: rsiPeriod, oversold: rsiOversold, overbought: 70 }
        ]
      ));
    });
  });
});

// ----------------------------------------------------------------------------------
// 3. TRIPLE THREATS (Classical Wall St Setups)
// ----------------------------------------------------------------------------------

// The Wall St Swing Setup (SMA + MACD + RSI)
smaPairs.forEach(([sFast, sSlow]) => {
  MASTER_STRATEGY_LIBRARY.push(createNamedStrategy(
    `The Wall St Swing Setup (SMA ${sFast}/${sSlow} + MACD + RSI)`,
    [
      { type: 'SMA', fastPeriod: sFast, slowPeriod: sSlow },
      { type: 'MACD', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      { type: 'RSI', period: 14, oversold: 40, overbought: 70 }
    ]
  ));
});

// ADX + MACD + PSAR (The Directional Parabola)
MASTER_STRATEGY_LIBRARY.push(createNamedStrategy(
  `The Directional Parabola (ADX + MACD + PSAR Trail)`,
  [
    { type: 'ADX', period: 14, strongThreshold: 20 },
    { type: 'MACD', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    { type: 'PSAR', step: 0.02, maxStep: 0.2 } // PSAR used as trailing stop
  ]
));

// The Volatility Rider (BB + Stochastic + ATR Trailing Stop)
MASTER_STRATEGY_LIBRARY.push(createNamedStrategy(
  `The Volatility Rider (BB Breakout + Stoch + ATR Stop)`,
  [
    { type: 'BB', period: 20, multiplier: 2 },
    { type: 'STOCH', period: 14, smoothK: 3, smoothD: 3, oversold: 50, overbought: 80 },
    { type: 'ATR', period: 14, multiplier: 3 } // ATR used purely as trailing stop exit
  ]
));

// Ichimoku + RSI + OBV (The Japanese Volume Cloud)
MASTER_STRATEGY_LIBRARY.push(createNamedStrategy(
  `Japanese Volume Cloud (Ichimoku + OBV + RSI)`,
  [
    { type: 'ICHIMOKU', tenkan: 9, kijun: 26, senkouB: 52 },
    { type: 'OBV', period: 20 },
    { type: 'RSI', period: 14, oversold: 50, overbought: 80 }
  ]
));

// ----------------------------------------------------------------------------------
// 4. QUADRUPLE CUSTOM (AI Hyper-Strict Setups)
// ----------------------------------------------------------------------------------

// The Ultimate Alpha Confluence (SMA + MACD + RSI + ATR Stop)
MASTER_STRATEGY_LIBRARY.push(createNamedStrategy(
  `Ultimate Alpha Confluence (Trend + Mom + Rev + Vol)`,
  [
    { type: 'SMA', fastPeriod: 50, slowPeriod: 200 }, // Long term trend
    { type: 'MACD', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }, // Momentum confirming
    { type: 'RSI', period: 10, oversold: 50, overbought: 80 }, // Short term dip
    { type: 'ATR', period: 14, multiplier: 2.5 } // Tight trailing stop
  ]
));

// The Institutional Sniper (VWAP + ADX + OBV + PSAR)
MASTER_STRATEGY_LIBRARY.push(createNamedStrategy(
  `Institutional Sniper (VWAP + ADX + OBV + PSAR)`,
  [
    { type: 'VWAP', period: 20 },
    { type: 'ADX', period: 14, strongThreshold: 25 },
    { type: 'OBV', period: 20 },
    { type: 'PSAR', step: 0.02, maxStep: 0.2 }
  ]
));

// Aggressive Growth Protocol
MASTER_STRATEGY_LIBRARY.push(createNamedStrategy(
  `Aggressive Growth Protocol (EMA 20/50 + CCI + Stoch + BB)`,
  [
    { type: 'EMA', fastPeriod: 20, slowPeriod: 50 },
    { type: 'CCI', period: 20, oversold: -100, overbought: 100 },
    { type: 'STOCH', period: 14, smoothK: 3, smoothD: 3, oversold: 40, overbought: 80 },
    { type: 'BB', period: 20, multiplier: 1.5 } // Very tight bands
  ]
));
