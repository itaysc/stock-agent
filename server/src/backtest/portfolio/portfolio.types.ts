import type { BacktestResult } from '../backtest-engine.js';
import type { BacktestMetrics, EquityPoint } from '../backtest-metrics.js';

/** One part of the portfolio: a strategy with fixed settings on its own symbols and share of the money. */
export interface Sleeve {
  strategy: string;
  symbols: string[];
  params: Record<string, string>;
  /** Share of the starting cash, in percent. What's left over stays in cash (earning interest). */
  weightPct: number;
}

export interface PortfolioRisk {
  /** Sell everything when the whole portfolio is this % below its peak (0 = off). */
  maxDrawdownPct: number;
  /** After the stop, no new buys for this many days. */
  cooldownDays: number;
}

export interface PortfolioRequest {
  sleeves: Sleeve[];
  risk: PortfolioRisk;
  timeframe: string;
  from: Date;
  to: Date;
  initialCash: number;
  slippageBps: number;
  feePerShare: number;
  cashYieldPct: number;
  /** Skip buys on bad news before the open (see BrokerOptions.newsGateTone). */
  newsGateTone?: number;
}

export interface SleeveResult {
  sleeve: Sleeve;
  label: string;
  allocated: number;
  result: BacktestResult;
  /** Money this sleeve added (or lost), in dollars. */
  contribution: number;
  /** The same money bought and held in the sleeve's symbols. */
  holdReturnPct: number | null;
}

export interface StopEvent {
  timestamp: Date;
  drawdownPct: number;
  equity: number;
  resumesAt: Date;
}

export interface PortfolioResult {
  from?: Date;
  to?: Date;
  initialCash: number;
  finalEquity: number;
  /** Cash no sleeve was given (it earns the cash yield). */
  reserve: { allocated: number; final: number };
  metrics: BacktestMetrics;
  equityCurve: EquityPoint[];
  /** Each sleeve's money bought and held in its own symbols, plus the reserve. Aligned with equityCurve. */
  benchmark: number[];
  benchmarkReturnPct: number | null;
  benchmarkMaxDrawdownPct: number;
  interestEarned: number;
  sleeves: SleeveResult[];
  /** How alike the sleeves' daily moves are (-1..1); null when a sleeve never moved. */
  correlation: Array<Array<number | null>>;
  stops: StopEvent[];
  risk: PortfolioRisk;
}
