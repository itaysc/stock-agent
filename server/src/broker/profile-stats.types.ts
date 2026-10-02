/** One test's numbers (from the algo lab), for a profile or SPY. */
export interface StatsSummary {
  from: string | Date;
  to: string | Date;
  totalPct: number;
  annualPct: number;
  maxDrawdownPct: number;
  worstYear: { year: number; pct: number };
  bestYear: { year: number; pct: number };
  positiveYearsPct: number;
  years: Array<{ year: number; pct: number }>;
}

export interface ProfileStats extends StatsSummary {
  /** SPY (buy and hold) over the same span, to compare with. */
  spy: StatsSummary;
  method: string;
  universe: string;
}

export interface ProfileStatsFile {
  testedAt: string | Date;
  profiles: Record<string, ProfileStats>;
}
