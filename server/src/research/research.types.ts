import type { TestPlan } from '../backtest/plans/test-plan.js';
import type { BasketId } from './robustness/baskets.js';
import type { RobustnessResult } from './robustness/robustness.types.js';

/** What the agent optimizes (always measured on unseen walk-forward periods). */
export const RESEARCH_GOALS = ['risk-adjusted', 'beat-hold', 'return'] as const;
export type ResearchGoal = (typeof RESEARCH_GOALS)[number];

export interface ResearchRequest {
  symbols: string[];
  timeframe: string;
  from: Date;
  to: Date;
  /** The final stretch hidden from the agent, used once at the end, e.g. "12m". */
  holdout: string;
  /** Strategies the agent may use. */
  strategies: string[];
  goal: ResearchGoal;
  /** Max rounds of "propose tests → run → learn". */
  rounds: number;
  testsPerRound: number;
  initialCash: number;
  slippageBps: number;
  feePerShare: number;
  /** Yearly interest on idle cash, in percent. */
  cashYieldPct: number;
  /** Skip buys on bad news before the open (see BrokerOptions.newsGateTone); 0 = off. */
  newsGateTone?: number;
  /** Basket for the multi-symbol check of the best test; null = skip it. */
  basket: BasketId | null;
}

/** The numbers of one walk-forward test that the agent and the reports use. */
export interface Outcome {
  /** Unseen (out-of-sample) span. */
  from: Date;
  to: Date;
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
  /** The setting picked on the latest training window. */
  latestPick: { strategy: string; params: Record<string, string> } | null;
}

export interface Experiment {
  id: number;
  round: number;
  plan: TestPlan;
  outcome?: Outcome;
  score?: number;
  /** Too few trades to mean much: ranked below every test with enough. */
  weak?: boolean;
  error?: string;
}

export interface ResearchRound {
  round: number;
  /** The agent's reasoning: what it learned, what it tests next. */
  thinking: string;
  /** Proposals the menu rejected, with the reason (shown to the agent next round). */
  rejected: string[];
  /** Ideas for new building blocks or strategies outside the menu. */
  ideas: string[];
}

export interface ResearchVerdict {
  headline: string;
  points: string[];
  recommendation: string;
  model: string;
}

export type ResearchStatus = 'running' | 'done' | 'failed';

export interface ResearchSession {
  id: string;
  status: ResearchStatus;
  request: ResearchRequest;
  /** Research period (walk-forward tests) and the holdout after it. */
  researchTo: Date;
  rounds: ResearchRound[];
  experiments: Experiment[];
  championId: number | null;
  /** The champion's walk-forward on the holdout, run once at the end. */
  holdout: { outcome: Outcome; score: number } | null;
  /** The best test on each symbol of the basket, over the whole period. */
  robustness: RobustnessResult | null;
  /** Passed every gate (holdout better than holding, and the multi-symbol check): worth paper trading. */
  candidate: boolean;
  verdict: ResearchVerdict | null;
  stoppedBecause: string | null;
  reportUrl: string | null;
  error: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}
