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
  /** How hard it was to live with (see pain-stats in the lab). */
  pain?: {
    calmar: number;
    ulcerIndex: number;
    longestUnderwaterMonths: number;
    vsSpy3y?: { trailedPct: number; worstGapPct: number };
  };
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

/** How solid a profile's numbers are: the same test with the re-rank day moved and random stocks left out. */
export interface ProfileRobustness {
  /** The middle half of the yearly returns over all the variations (in %). */
  usualPct: [number, number];
  /** The deepest drop in any variation (in %). */
  worstDropPct: number;
  /** How many variations were run. */
  runs: number;
  /** Its yearly return in each part of the test, next to SPY's. */
  periods: Array<{ from: number; to: number; pct: number; spyPct: number }>;
  /** Beating SPY month by month: 2 or more means more than luck. */
  tVsSpy: number;
}

export interface ProfileRobustnessFile {
  testedAt: string | Date;
  method: string;
  profiles: Record<string, ProfileRobustness>;
}
