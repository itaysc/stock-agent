/**
 * What the broker picks from: about 50 of the biggest US companies (long
 * price histories, easy to trade), and a safe asset for downtrends.
 */
export const BROKER_STOCKS = [
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
];

/** Short-term US Treasury bills ETF: where money waits when nothing is trending up. */
export const SAFE_ASSET = 'BIL';

/**
 * The algo's settings: classic "12-1" momentum (rank by the last 12 months,
 * leaving out the latest month), top 5, re-checked weekly. Chosen in the algo
 * lab (src/broker/lab) because it and every setting near it beat SPY on both
 * stock lists, and because re-tuning them every 6 months did worse.
 */
export const DEFAULT_PARAMS: Record<string, string> = {
  lookback: '252',
  skipRecent: '21',
  topN: '5',
  rebalanceDays: '5',
  volWeight: '1',
  absMomentum: '1',
  safeLast: '1',
  band: '2',
  // Trailing stop: sell when it closes 25% below its highest close since bought (it rises with the
  // price, so it also locks in gains). No fixed take-profit: in the lab, take-profits and tighter stops cut the winners short.
  stopPct: '25',
  // Fractional shares: small amounts can still hold pricey stocks.
  fractional: '1',
};

/** How it was tested, honestly (algo lab, Oct 2026). */
export const TESTED =
  'Tested Jul 2022 → Oct 2026: +310% on these 50 stocks and +326% on the 50 biggest of end-2020 (a fairer test: those were not picked knowing who would win), vs SPY +101%; worst drop -28%. These settings were chosen after looking at this period, so expect less: the fully honest version (settings re-picked on past data only) made +172% to +193%. Past results, not a promise.';

/** The algo in one sentence, for these settings. */
export function algoText(p: Record<string, string>): string {
  const months = Math.max(1, Math.round(Number(p.lookback) / 21));
  const every = Number(p.rebalanceDays) <= 5 ? 'every week' : 'every month';
  const skip =
    Number(p.skipRecent) > 0
      ? ' (leaving out the latest month, which tends to reverse)'
      : '';
  return `Holds the ${p.topN} stocks that rose most over the last ${months} months${skip}, only ones still rising, more of the calmer ones. Re-checks ${every}: sells what dropped out, buys what came in. When fewer stocks are rising, the rest waits in T-bills (${SAFE_ASSET}).`;
}
