export type FiuTransaction = {
  txnId: string;
  txnDate: string; // YYYY-MM-DD
  type: 'SIP' | 'PURCHASE' | 'REDEMPTION' | 'SWITCH_IN' | 'SWITCH_OUT';
  amount: number;
  units: number;
  nav: number;
};

export type FiuScheme = {
  schemeName: string;
  isin: string;
  transactions: FiuTransaction[];
};

export function convertFiuDataToCsv(schemes: FiuScheme[]): string {
  const header = 'symbol,isin,trade_date,exchange,segment,series,trade_type,quantity,price,trade_id,order_id,order_execution_time';
  const rows: string[] = [];

  for (const scheme of schemes) {
    // Generate a short symbol from the scheme name (e.g. "Parag Parikh Flexi Cap" -> "PARAG_PARIKH")
    const shortSymbol = scheme.schemeName.split(' ').slice(0, 3).join('_').toUpperCase().replace(/[^A-Z0-9_]/g, '');

    for (const tx of scheme.transactions) {
      const typeStr = (tx.type === 'SIP' || tx.type === 'PURCHASE' || tx.type === 'SWITCH_IN') ? 'buy' : 'sell';
      const row = [
        shortSymbol,
        scheme.isin,
        tx.txnDate,
        'BSE', // Exchange doesn't matter for MF
        'MF',
        'EQ',
        typeStr,
        tx.units.toString(),
        tx.nav.toString(),
        `AA_${tx.txnId}`, // prefix to ensure uniqueness
        `AA_ORD_${tx.txnId}`,
        `${tx.txnDate}T10:00:00Z`
      ];
      rows.push(row.join(','));
    }
  }

  return [header, ...rows].join('\n');
}

export const mockFiuData: FiuScheme[] = [
  {
    schemeName: "Parag Parikh Flexi Cap Fund Direct Growth",
    isin: "INF846K01164",
    transactions: [
      {
        txnId: "TXN10001",
        txnDate: "2022-01-15",
        type: "SIP",
        amount: 10000,
        units: 200.5,
        nav: 49.87
      },
      {
        txnId: "TXN10002",
        txnDate: "2022-02-15",
        type: "SIP",
        amount: 10000,
        units: 198.2,
        nav: 50.45
      },
      {
        txnId: "TXN10003",
        txnDate: "2023-01-10",
        type: "REDEMPTION",
        amount: 5000,
        units: 80.0,
        nav: 62.50
      }
    ]
  },
  {
    schemeName: "HDFC Index Fund Nifty 50 Plan Direct Growth",
    isin: "INF179K01W81",
    transactions: [
      {
        txnId: "TXN20001",
        txnDate: "2023-05-10",
        type: "PURCHASE",
        amount: 50000,
        units: 312.5,
        nav: 160.00
      },
      {
        txnId: "TXN20002",
        txnDate: "2024-01-05",
        type: "SIP",
        amount: 5000,
        units: 28.5,
        nav: 175.43
      }
    ]
  }
];
