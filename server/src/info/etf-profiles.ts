/**
 * Well-known ETFs and, where a few names carry real weight, their biggest
 * holdings. Alpaca has no holdings data, so this is maintained by hand:
 * APPROXIMATE weights (% of the fund) as of around mid-2025 — check the
 * issuer's site and update now and then. Used by the live news check only.
 */
export interface EtfProfile {
  kind: 'index' | 'sector' | 'bonds' | 'commodity' | 'international';
  name: string;
  /** [symbol, approximate weight %], biggest first; absent when no holding is big. */
  holdings?: Array<[string, number]>;
}

export const ETF_HOLDINGS_AS_OF = 'mid-2025 (approximate)';

export const ETF_PROFILES: Record<string, EtfProfile> = {
  SPY: {
    kind: 'index',
    name: 'S&P 500',
    holdings: [
      ['NVDA', 7],
      ['MSFT', 7],
      ['AAPL', 6],
      ['AMZN', 4],
      ['META', 3],
      ['AVGO', 2.5],
      ['GOOGL', 2],
    ],
  },
  VOO: {
    kind: 'index',
    name: 'S&P 500',
    holdings: [
      ['NVDA', 7],
      ['MSFT', 7],
      ['AAPL', 6],
      ['AMZN', 4],
      ['META', 3],
    ],
  },
  IVV: {
    kind: 'index',
    name: 'S&P 500',
    holdings: [
      ['NVDA', 7],
      ['MSFT', 7],
      ['AAPL', 6],
      ['AMZN', 4],
      ['META', 3],
    ],
  },
  QQQ: {
    kind: 'index',
    name: 'Nasdaq 100',
    holdings: [
      ['NVDA', 9],
      ['MSFT', 9],
      ['AAPL', 7.5],
      ['AMZN', 5.5],
      ['AVGO', 5],
      ['META', 3.5],
      ['NFLX', 3],
    ],
  },
  DIA: {
    kind: 'index',
    name: 'Dow Jones',
    holdings: [
      ['GS', 10],
      ['MSFT', 7],
      ['HD', 5.5],
      ['CAT', 5.5],
      ['V', 5],
      ['SHW', 5],
    ],
  },
  IWM: { kind: 'index', name: 'Russell 2000 small caps' },
  VTI: {
    kind: 'index',
    name: 'US total market',
    holdings: [
      ['NVDA', 6],
      ['MSFT', 6],
      ['AAPL', 5.5],
      ['AMZN', 3.5],
    ],
  },
  XLK: {
    kind: 'sector',
    name: 'Technology',
    holdings: [
      ['NVDA', 15],
      ['MSFT', 13],
      ['AAPL', 12],
      ['AVGO', 5],
      ['ORCL', 3.5],
    ],
  },
  XLF: {
    kind: 'sector',
    name: 'Financials',
    holdings: [
      ['BRK.B', 12],
      ['JPM', 10.5],
      ['V', 8],
      ['MA', 6],
      ['BAC', 4.5],
    ],
  },
  XLE: {
    kind: 'sector',
    name: 'Energy',
    holdings: [
      ['XOM', 23],
      ['CVX', 16],
      ['COP', 7],
      ['WMB', 4.5],
      ['EOG', 4.5],
    ],
  },
  XLV: {
    kind: 'sector',
    name: 'Health care',
    holdings: [
      ['LLY', 12],
      ['JNJ', 8],
      ['ABBV', 7],
      ['UNH', 5],
      ['ABT', 4.5],
    ],
  },
  XLY: {
    kind: 'sector',
    name: 'Consumer discretionary',
    holdings: [
      ['AMZN', 23],
      ['TSLA', 15],
      ['HD', 7],
      ['MCD', 4.5],
      ['BKNG', 4.5],
    ],
  },
  XLP: {
    kind: 'sector',
    name: 'Consumer staples',
    holdings: [
      ['COST', 10],
      ['WMT', 10],
      ['PG', 9],
      ['KO', 6],
      ['PM', 6],
    ],
  },
  XLI: {
    kind: 'sector',
    name: 'Industrials',
    holdings: [
      ['GE', 6],
      ['RTX', 4.5],
      ['CAT', 4],
      ['UBER', 4],
      ['BA', 3.5],
    ],
  },
  XLU: {
    kind: 'sector',
    name: 'Utilities',
    holdings: [
      ['NEE', 12],
      ['SO', 8],
      ['CEG', 8],
      ['DUK', 7.5],
      ['VST', 5],
    ],
  },
  XLB: {
    kind: 'sector',
    name: 'Materials',
    holdings: [
      ['LIN', 16],
      ['SHW', 7],
      ['ECL', 6],
      ['APD', 5.5],
      ['NEM', 5.5],
    ],
  },
  XLRE: {
    kind: 'sector',
    name: 'Real estate',
    holdings: [
      ['PLD', 9],
      ['AMT', 9],
      ['WELL', 8],
      ['EQIX', 7],
      ['SPG', 4.5],
    ],
  },
  XLC: {
    kind: 'sector',
    name: 'Communication services',
    holdings: [
      ['META', 20],
      ['GOOGL', 12],
      ['GOOG', 10],
      ['NFLX', 6],
    ],
  },
  SMH: {
    kind: 'sector',
    name: 'Semiconductors',
    holdings: [
      ['NVDA', 20],
      ['TSM', 12],
      ['AVGO', 8],
      ['AMD', 5],
    ],
  },
  TLT: { kind: 'bonds', name: 'US Treasuries, 20+ years' },
  IEF: { kind: 'bonds', name: 'US Treasuries, 7-10 years' },
  SHY: { kind: 'bonds', name: 'US Treasuries, 1-3 years' },
  AGG: { kind: 'bonds', name: 'US bonds, aggregate' },
  GLD: { kind: 'commodity', name: 'Gold' },
  SLV: { kind: 'commodity', name: 'Silver' },
  USO: { kind: 'commodity', name: 'Oil' },
  EFA: { kind: 'international', name: 'Developed markets ex-US' },
  EEM: { kind: 'international', name: 'Emerging markets' },
  VXUS: { kind: 'international', name: 'World ex-US' },
};

/** Holdings big enough that a serious event there matters for the fund (weight ≥ minPct). */
export function bigHoldings(
  symbol: string,
  minPct = 5,
): Array<[string, number]> {
  return (ETF_PROFILES[symbol]?.holdings ?? []).filter(([, w]) => w >= minPct);
}
