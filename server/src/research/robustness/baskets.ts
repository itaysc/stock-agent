/** Ready-made watchlists for the multi-symbol check. */
export const BASKETS = {
  megacaps: {
    name: 'Mega caps',
    description: '10 of the largest US companies',
    symbols: [
      'AAPL',
      'MSFT',
      'NVDA',
      'AMZN',
      'GOOGL',
      'META',
      'TSLA',
      'JPM',
      'V',
      'UNH',
    ],
  },
  sectors: {
    name: 'Sector ETFs',
    description:
      'The 11 S&P 500 sector funds (tech, banks, energy, health, ...)',
    symbols: [
      'XLK',
      'XLF',
      'XLE',
      'XLV',
      'XLY',
      'XLP',
      'XLI',
      'XLU',
      'XLB',
      'XLRE',
      'XLC',
    ],
  },
  indexes: {
    name: 'Index ETFs',
    description: 'S&P 500, Nasdaq 100, small caps, Dow',
    symbols: ['SPY', 'QQQ', 'IWM', 'DIA'],
  },
} as const;

export type BasketId = keyof typeof BASKETS;
export const BASKET_IDS = Object.keys(BASKETS) as BasketId[];

/** The basket's symbols plus any extra ones, upper-cased and without duplicates. */
export function basketSymbols(
  basket: BasketId | null | undefined,
  extra: string[] = [],
): string[] {
  const base = basket ? BASKETS[basket].symbols : [];
  return [
    ...new Set(
      [...base, ...extra].map((s) => s.trim().toUpperCase()).filter(Boolean),
    ),
  ];
}

export function listBaskets() {
  return BASKET_IDS.map((id) => ({
    id,
    ...BASKETS[id],
    symbols: [...BASKETS[id].symbols],
  }));
}
