/**
 * Each symbol's sector (Yahoo's names), for maxPerSector. The broker's
 * stocks are known here; the algo lab adds the rest (from Yahoo). A symbol
 * without a sector counts as its own, so the cap never applies to it.
 */
const SECTORS = new Map<string, string>(
  Object.entries({
    Technology:
      'AAPL MSFT NVDA AVGO CRM ORCL AMD ADBE ACN CSCO TXN QCOM INTU IBM NOW AMAT',
    'Communication Services': 'GOOGL GOOG META NFLX',
    'Consumer Cyclical': 'AMZN TSLA HD MCD',
    'Consumer Defensive': 'COST PG WMT KO PEP',
    'Financial Services': 'BRK.B JPM V MA BAC WFC GS',
    Healthcare: 'LLY UNH JNJ ABBV MRK TMO ABT DHR AMGN ISRG',
    Energy: 'XOM CVX',
    'Basic Materials': 'LIN',
    Industrials: 'CAT GE',
  }).flatMap(([sector, list]) =>
    list.split(' ').map((s) => [s, sector] as const),
  ),
);

export const sectors = {
  of(symbol: string): string {
    return SECTORS.get(symbol) ?? `(${symbol})`;
  },
  add(map: Record<string, string>): void {
    for (const [s, sector] of Object.entries(map))
      if (sector) SECTORS.set(s, sector);
  },
};
