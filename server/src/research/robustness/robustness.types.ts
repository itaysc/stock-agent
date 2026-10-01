import type { TestPlan } from '../../backtest/plans/test-plan.js';
import type { Outcome, ResearchGoal } from '../research.types.js';

/** Share of symbols a setup must do better than holding on to pass. */
export const PASS_SHARE = 0.6;

export interface RobustnessRequest {
  /** A walk-forward test plan (the setup to check). */
  plan: TestPlan;
  /** Each symbol is tested on its own. */
  symbols: string[];
  timeframe: string;
  from: Date;
  to: Date;
  goal: ResearchGoal;
  initialCash: number;
  slippageBps: number;
  feePerShare: number;
  cashYieldPct: number;
  newsGateTone?: number;
}

export interface SymbolResult {
  symbol: string;
  outcome?: Outcome;
  /** Above 0 = better than just holding this symbol, for the goal. */
  score?: number;
  error?: string;
}

export interface RobustnessSummary {
  tested: number;
  madeMoney: number;
  /** Symbols with a score above 0 (better than holding for the goal). */
  beatHold: number;
  medianScore: number | null;
  /** Median of (annual return − buy & hold's annual return), in points. */
  medianEdgePct: number | null;
  passed: boolean;
  /** e.g. "Better than holding on 7 of 10 symbols." */
  verdict: string;
}

export interface RobustnessResult {
  plan: TestPlan;
  /** symbols: each symbol on its own; universes: each group as a whole (rotation). */
  mode: 'symbols' | 'universes';
  goal: ResearchGoal;
  from: Date;
  to: Date;
  rows: SymbolResult[];
  summary: RobustnessSummary;
}
