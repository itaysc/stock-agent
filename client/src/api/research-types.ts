/** Shapes of the research agent (/api/v1/research) and of AI-proposed test plans. */
import type { SortKey } from './types';

export type ResearchGoal = 'risk-adjusted' | 'beat-hold' | 'return';

/** A follow-up test from the server's fixed menu (validated there). */
export interface TestPlan {
  kind: 'walkforward' | 'sweep';
  strategies: string[];
  /** Values to try per param, sweep syntax ("10", "5,10,20", "5..30:5"). */
  params: Record<string, string>;
  train?: string;
  test?: string;
  anchored?: boolean;
  sort: SortKey;
  minTrades: number;
  why: string;
}

/** Symbols, period and costs a suggested test runs with (those of the run it came from). */
export interface PlanContext {
  symbols: string[];
  from: string;
  to: string;
  timeframe: string;
  initialCash: number;
  slippageBps: number;
  feePerShare: number;
  cashYieldPct?: number;
  newsGateTone?: number;
}

export interface Outcome {
  from: string;
  to: string;
  returnPct: number;
  holdReturnPct: number | null;
  annualPct: number | null;
  holdAnnualPct: number | null;
  maxDrawdownPct: number;
  holdMaxDrawdownPct: number;
  trades: number;
  winRatePct: number | null;
  profitFactor: number | null;
  efficiencyPct: number | null;
  windows: number;
  distinctSettings: number;
  paramChanges: number;
  latestPick: { strategy: string; params: Record<string, string> } | null;
}

export interface Experiment {
  id: number;
  round: number;
  plan: TestPlan;
  outcome?: Outcome;
  score?: number;
  weak?: boolean;
  error?: string;
}

export interface ResearchRound {
  round: number;
  thinking: string;
  rejected: string[];
  ideas: string[];
}

export interface ResearchSession {
  id: string;
  status: 'running' | 'done' | 'failed';
  request: {
    symbols: string[];
    from: string;
    to: string;
    holdout: string;
    strategies: string[];
    goal: ResearchGoal;
    rounds: number;
    testsPerRound: number;
    initialCash: number;
    basket: string | null;
  };
  researchTo: string;
  rounds: ResearchRound[];
  experiments: Experiment[];
  championId: number | null;
  holdout: { outcome: Outcome; score: number } | null;
  robustness: RobustnessResult | null;
  /** Passed every gate (holdout + multi-symbol check). */
  candidate: boolean;
  verdict: { headline: string; points: string[]; recommendation: string; model: string } | null;
  stoppedBecause: string | null;
  reportUrl: string | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface Basket {
  id: string;
  name: string;
  description: string;
  symbols: string[];
}

export interface SymbolResult {
  symbol: string;
  outcome?: Outcome;
  score?: number;
  error?: string;
}

/** The multi-symbol check: one setup run on each symbol on its own. */
export interface RobustnessResult {
  plan: TestPlan;
  /** symbols: each symbol on its own; universes: each group as a whole (rotation). */
  mode?: 'symbols' | 'universes';
  goal: ResearchGoal;
  from: string;
  to: string;
  rows: SymbolResult[];
  summary: {
    tested: number;
    madeMoney: number;
    beatHold: number;
    medianScore: number | null;
    medianEdgePct: number | null;
    passed: boolean;
    verdict: string;
  };
  /** Only in the /robustness response. */
  label?: string;
  initialCash?: number;
}
