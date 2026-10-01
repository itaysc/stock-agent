import type { PlanContext } from '../plans/plan-menu.js';
import type { TestPlan } from '../plans/test-plan.js';

/** Short AI review of a backtest, sweep or walk-forward test. */
export interface AiSummary {
  /** One-sentence verdict. */
  headline: string;
  /** 2-4 short key points. */
  points: string[];
  /** What to do next with this research (never a buy/sell call). */
  recommendation: string;
  /** Up to 3 follow-up tests from the test menu, validated (older summaries have none). */
  nextTests?: TestPlan[];
  /** Symbols, period and costs the next tests run with. */
  testContext?: PlanContext;
  model: string;
}

export type AiSummaryOutcome = { summary: AiSummary } | { skipped: string };
