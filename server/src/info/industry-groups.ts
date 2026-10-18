/** A stock's industry: its closest peers (inside or outside the broker's 50) and the group's ETF. */
export interface Industry {
  group: string;
  members: string[];
  etf: string;
}

const GROUPS: Industry[] = [
  {
    group: 'chip equipment',
    members: ['AMAT', 'LRCX', 'KLAC', 'ASML'],
    etf: 'SMH',
  },
  {
    group: 'chips',
    members: ['NVDA', 'AMD', 'AVGO', 'TXN', 'QCOM', 'MU', 'INTC'],
    etf: 'SMH',
  },
  {
    group: 'software',
    members: ['MSFT', 'CRM', 'ORCL', 'ADBE', 'INTU', 'NOW'],
    etf: 'IGV',
  },
  { group: 'IT services', members: ['ACN', 'IBM'], etf: 'XLK' },
  {
    group: 'hardware and networking',
    members: ['AAPL', 'CSCO', 'DELL', 'ANET'],
    etf: 'XLK',
  },
  {
    group: 'internet and media',
    members: ['GOOGL', 'GOOG', 'META', 'NFLX'],
    etf: 'XLC',
  },
  { group: 'online retail', members: ['AMZN'], etf: 'XLY' },
  { group: 'electric cars', members: ['TSLA', 'GM', 'F', 'RIVN'], etf: 'XLY' },
  { group: 'retail', members: ['HD', 'COST', 'WMT', 'LOW', 'TGT'], etf: 'XRT' },
  { group: 'restaurants', members: ['MCD', 'SBUX', 'CMG'], etf: 'XLY' },
  {
    group: 'household and drinks',
    members: ['PG', 'KO', 'PEP', 'CL'],
    etf: 'XLP',
  },
  {
    group: 'banks',
    members: ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'C'],
    etf: 'XLF',
  },
  { group: 'payments', members: ['V', 'MA', 'AXP', 'PYPL'], etf: 'XLF' },
  { group: 'insurance and holdings', members: ['BRK.B'], etf: 'XLF' },
  {
    group: 'drugs',
    members: ['LLY', 'JNJ', 'ABBV', 'MRK', 'AMGN', 'PFE', 'NVO'],
    etf: 'XLV',
  },
  {
    group: 'health insurers',
    members: ['UNH', 'CVS', 'CI', 'ELV', 'HUM'],
    etf: 'XLV',
  },
  {
    group: 'medical tools',
    members: ['TMO', 'DHR', 'ABT', 'ISRG'],
    etf: 'XLV',
  },
  { group: 'oil and gas', members: ['XOM', 'CVX', 'COP'], etf: 'XLE' },
  { group: 'chemicals', members: ['LIN', 'APD'], etf: 'XLB' },
  {
    group: 'machinery and aerospace',
    members: ['CAT', 'GE', 'DE', 'HON'],
    etf: 'XLI',
  },
];

/** The stock's industry with its peers (the stock itself left out); null for one we don't know. */
export function industryOf(symbol: string): Industry | null {
  const g = GROUPS.find((x) => x.members.includes(symbol));
  return g ? { ...g, members: g.members.filter((m) => m !== symbol) } : null;
}
