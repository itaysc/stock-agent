/** Shapes returned by the server's /api/v1 backtest endpoints. */
import type { Basket, PlanContext, ResearchGoal, TestPlan } from './research-types';

export interface StrategyInfo {
  name: string;
  description: string;
  version: number;
  params: ParamInfo[];
}

/** A strategy param with its default, limits and explanation (from the server). */
export interface ParamInfo {
  name: string;
  /** null = computed (allocation: 1 / number of symbols). */
  default: number | null;
  min: number;
  max?: number;
  integer?: boolean;
  /** Must be smaller than this other param. */
  lessThan?: string;
  /** 0 turns this rule off. */
  zeroIsOff?: boolean;
  description: string;
}

export type SortKey = 'return' | 'drawdown' | 'profit-factor' | 'return-dd';

export interface BacktestOptions {
  strategies: StrategyInfo[];
  timeframes: string[];
  sortKeys: SortKey[];
  maxCombinations: number;
  dataFeed: 'iex' | 'sip';
  dataStart: string;
  aiEnabled: boolean;
  baskets: Basket[];
  defaults: {
    timeframe: string;
    cash: number;
    slippageBps: number;
    feePerShare: number;
    cashYieldPct: number;
    years: number;
    walkForward: { train: string; test: string; sort: SortKey; years: number };
    research: {
      goals: ResearchGoal[];
      holdout: string;
      rounds: number;
      testsPerRound: number;
      basket: string;
      years: number;
    };
  };
}

export interface Metrics {
  totalReturnPct: number;
  maxDrawdownPct: number;
  trades: number;
  winRatePct: number | null;
  profitFactor: number | null;
  totalFees: number;
  buyAndHoldReturnPct: number | null;
}

export interface AiSummary {
  headline: string;
  points: string[];
  recommendation: string;
  /** Follow-up tests the AI proposed from the server's menu. */
  nextTests?: TestPlan[];
  testContext?: PlanContext;
  model: string;
}

export type HistoryStatus =
  | { kind: 'new' }
  | { kind: 'reused'; savedAt: string }
  | { kind: 'replaced'; reason: string }
  | { kind: 'forced' };

interface RunCommon {
  reportUrl: string | null;
  symbols: string[];
  from: string | null;
  to: string | null;
  bars: number;
  aiSummary: AiSummary | null;
  aiSkipped: string | null;
}

export interface BacktestResponse extends RunCommon {
  kind: 'backtest';
  history: HistoryStatus;
  strategy: string;
  initialCash: number;
  finalEquity: number;
  /** Interest earned on idle cash (included in finalEquity). */
  interestEarned: number;
  metrics: Metrics;
  holdMaxDrawdownPct: number;
  openPositions: Array<{ symbol: string; qty: number; avgPrice: number }>;
  rejections: number;
  aiSaved: boolean;
}

export interface SweepRun {
  id: number;
  rank: number;
  strategy: string;
  label: string;
  params: Record<string, string>;
  returnPct: number;
  maxDrawdownPct: number;
  trades: number;
  winRatePct: number | null;
  profitFactor: number | null;
  beatHold: boolean;
}

export interface SweepResponse extends RunCommon {
  kind: 'sweep';
  runs: number;
  hidden: number;
  skipped: number;
  buyAndHoldReturnPct: number | null;
  holdMaxDrawdownPct: number;
  initialCash: number;
  summaries: Array<{
    strategy: string;
    runs: number;
    medianReturnPct: number | null;
    positive: number;
    beatHold: number;
    bestReturnPct: number | null;
  }>;
  top: SweepRun[];
}

export interface WalkForwardWindow {
  index: number;
  trainFrom: string;
  trainTo: string;
  testFrom: string;
  testTo: string;
  chosen: {
    strategy: string;
    params: Record<string, string>;
    trainReturnPct: number;
    trainMaxDrawdownPct: number;
    trainTrades: number;
  } | null;
  test: {
    returnPct: number;
    maxDrawdownPct: number;
    trades: number;
    startEquity: number;
    endEquity: number;
    buyAndHoldReturnPct: number | null;
  } | null;
}

export interface WalkForwardResponse {
  kind: 'walkforward';
  reportUrl: string | null;
  strategies: string[];
  symbols: string[];
  /** e.g. "train 12 months, test 3 months (rolling), best by return-dd" */
  setup: string;
  oosFrom: string;
  oosTo: string;
  initialCash: number;
  finalEquity: number;
  interestEarned: number;
  cashYieldPct: number;
  metrics: Metrics;
  holdMaxDrawdownPct: number;
  inSampleAnnualPct: number | null;
  outOfSampleAnnualPct: number | null;
  efficiencyPct: number | null;
  paramChanges: number;
  distinctSettings: number;
  windows: WalkForwardWindow[];
  aiSummary: AiSummary | null;
  aiSkipped: string | null;
}

export interface SleeveInput {
  strategy: string;
  symbols: string[];
  params: Record<string, string>;
  weightPct: number;
}

export interface PortfolioResponse {
  kind: 'portfolio';
  reportUrl: string | null;
  from: string | null;
  to: string | null;
  initialCash: number;
  finalEquity: number;
  metrics: Metrics;
  benchmarkReturnPct: number | null;
  benchmarkMaxDrawdownPct: number;
  interestEarned: number;
  reserve: { allocated: number; final: number };
  sleeves: Array<{
    label: string;
    sleeve: SleeveInput;
    allocated: number;
    finalEquity: number;
    contribution: number;
    returnPct: number;
    holdReturnPct: number | null;
    maxDrawdownPct: number;
    trades: number;
  }>;
  correlation: Array<Array<number | null>>;
  stops: Array<{ timestamp: string; drawdownPct: number; equity: number; resumesAt: string }>;
  risk: { maxDrawdownPct: number; cooldownDays: number };
  aiSummary: AiSummary | null;
  aiSkipped: string | null;
}

export type RunResponse =
  BacktestResponse | SweepResponse | WalkForwardResponse | PortfolioResponse;

export interface ReportItem {
  name: string;
  url: string;
  kind: 'backtest' | 'sweep' | 'walkforward' | 'research' | 'portfolio';
  strategy: string;
  symbols: string[];
  period: string | null;
  createdAt: string;
  sizeKb: number;
}
