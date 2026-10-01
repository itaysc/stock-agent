/** Stock lists for the algo lab. */
export const UNIVERSES = {
  /** The broker's list: today's biggest (flatters a backtest: they are the winners). */
  today: [
    'AAPL',
    'MSFT',
    'NVDA',
    'AMZN',
    'GOOGL',
    'META',
    'AVGO',
    'TSLA',
    'BRK.B',
    'JPM',
    'LLY',
    'V',
    'UNH',
    'XOM',
    'MA',
    'COST',
    'HD',
    'PG',
    'JNJ',
    'WMT',
    'NFLX',
    'ABBV',
    'BAC',
    'CRM',
    'ORCL',
    'KO',
    'CVX',
    'MRK',
    'AMD',
    'PEP',
    'ADBE',
    'TMO',
    'LIN',
    'ACN',
    'MCD',
    'CSCO',
    'ABT',
    'WFC',
    'DHR',
    'TXN',
    'QCOM',
    'INTU',
    'AMGN',
    'IBM',
    'CAT',
    'GE',
    'NOW',
    'ISRG',
    'AMAT',
    'GS',
  ],
  /** The 50 biggest US companies at the end of 2020: what you could have picked then. */
  '2020': [
    'AAPL',
    'MSFT',
    'AMZN',
    'GOOGL',
    'META',
    'TSLA',
    'BRK.B',
    'JPM',
    'JNJ',
    'V',
    'UNH',
    'WMT',
    'NVDA',
    'PG',
    'MA',
    'HD',
    'DIS',
    'PYPL',
    'BAC',
    'INTC',
    'CMCSA',
    'VZ',
    'ADBE',
    'NFLX',
    'T',
    'KO',
    'PFE',
    'MRK',
    'CRM',
    'ABT',
    'PEP',
    'CSCO',
    'XOM',
    'TMO',
    'ABBV',
    'NKE',
    'CVX',
    'AVGO',
    'QCOM',
    'ACN',
    'MCD',
    'MDT',
    'COST',
    'TXN',
    'NEE',
    'WFC',
    'HON',
    'DHR',
    'LLY',
    'ORCL',
  ],
};

const FIXED = {
  volWeight: ['1'],
  absMomentum: ['1'],
  safeLast: ['1'],
  band: ['2'],
  fractional: ['1'],
};
const TUNED = {
  lookback: ['63', '126', '252'],
  topN: ['5', '10'],
  rebalanceDays: ['5', '21'],
};

/** Each variant is a method: the walk-forward picks its settings on past data only. */
export const VARIANTS: Array<{
  name: string;
  grid: Record<string, string[]>;
  tuned: string[];
}> = [
  {
    name: 'A current (tuned)',
    grid: { ...FIXED, ...TUNED },
    tuned: Object.keys(TUNED),
  },
  {
    name: 'A0 current, fixed 252/5/weekly',
    grid: { ...FIXED, lookback: ['252'], topN: ['5'], rebalanceDays: ['5'] },
    tuned: [],
  },
  {
    name: 'B + market filter 200d',
    grid: { ...FIXED, ...TUNED, marketFilter: ['200'] },
    tuned: Object.keys(TUNED),
  },
  {
    name: 'C + risk-adjusted rank',
    grid: { ...FIXED, ...TUNED, rankBy: ['1'] },
    tuned: Object.keys(TUNED),
  },
  {
    name: 'D + trailing stop 10/20%',
    grid: { ...FIXED, ...TUNED, stopPct: ['10', '20'] },
    tuned: [...Object.keys(TUNED), 'stopPct'],
  },
  {
    name: 'E + skip last month (12-1)',
    grid: { ...FIXED, ...TUNED, skipRecent: ['21'] },
    tuned: Object.keys(TUNED),
  },
  {
    name: 'F market filter + risk-adj',
    grid: { ...FIXED, ...TUNED, marketFilter: ['200'], rankBy: ['1'] },
    tuned: Object.keys(TUNED),
  },
  {
    name: 'G equal weights (no volWeight)',
    grid: { ...FIXED, ...TUNED, volWeight: ['0'] },
    tuned: Object.keys(TUNED),
  },
  {
    name: 'H no safe asset (BIL ranked)',
    grid: { ...FIXED, ...TUNED, safeLast: ['0'] },
    tuned: Object.keys(TUNED),
  },
];

const fixed = (name: string, over: Record<string, string>) => ({
  name,
  grid: {
    ...FIXED,
    lookback: ['252'],
    topN: ['5'],
    rebalanceDays: ['5'],
    ...Object.fromEntries(Object.entries(over).map(([k, v]) => [k, [v]])),
  },
  tuned: [] as string[],
});

/** Fixed settings around the classic one: a robust choice has good neighbours, not one lucky spike. */
export const SENSITIVITY = [
  fixed('S 252d top5 weekly (classic)', {}),
  fixed('S lookback 189d', { lookback: '189' }),
  fixed('S lookback 315d', { lookback: '315' }),
  fixed('S lookback 126d', { lookback: '126' }),
  fixed('S top 3', { topN: '3' }),
  fixed('S top 7', { topN: '7' }),
  fixed('S top 10', { topN: '10' }),
  fixed('S monthly', { rebalanceDays: '21' }),
  fixed('S every 2 weeks', { rebalanceDays: '10' }),
  fixed('S equal weights', { volWeight: '0' }),
  fixed('S 12-1 (skip month)', { skipRecent: '21' }),
  fixed('S market filter 200d', { marketFilter: '200' }),
  fixed('S stop 20%', { stopPct: '20' }),
  fixed('S stop 30%', { stopPct: '30' }),
  fixed('X 12-1 + every 2 weeks', { skipRecent: '21', rebalanceDays: '10' }),
  fixed('X 12-1 + 2 weeks + equal w', {
    skipRecent: '21',
    rebalanceDays: '10',
    volWeight: '0',
  }),
  fixed('X 12-1 + 2 weeks + top 7', {
    skipRecent: '21',
    rebalanceDays: '10',
    topN: '7',
  }),
  fixed('X 12-1 + 2 weeks + stop 20', {
    skipRecent: '21',
    rebalanceDays: '10',
    stopPct: '20',
  }),
];

const current = (name: string, over: Record<string, string>) =>
  fixed(name, { skipRecent: '21', ...over });

/** Stop losses and take-profits on top of the broker's settings. */
export const EXITS = [
  current('E broker now: no stop or target', {}),
  current('E trailing stop 15%', { stopPct: '15' }),
  current('E trailing stop 20%', { stopPct: '20' }),
  current('E trailing stop 25%', { stopPct: '25' }),
  current('E trailing stop 30%', { stopPct: '30' }),
  current('E trailing stop 40%', { stopPct: '40' }),
  current('E take profit +25%', { takeProfitPct: '25' }),
  current('E take profit +50%', { takeProfitPct: '50' }),
  current('E take profit +100%', { takeProfitPct: '100' }),
  current('E stop 25% + profit +100%', { stopPct: '25', takeProfitPct: '100' }),
];
