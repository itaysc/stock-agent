import type { Fill } from '../../strategies/strategy.types.js';
import type { BacktestMetrics, EquityPoint } from '../backtest-metrics.js';
import type { BacktestRequest } from '../backtest.service.js';
import type { ParamGrid } from '../sweep/param-grid.js';
import type { SortKey } from '../sweep/sweep-report.js';
import type { Duration } from './windows.js';

export interface WalkForwardRequest extends Omit<
  BacktestRequest,
  'strategy' | 'params'
> {
  strategies: string[];
  grid: ParamGrid;
  /** Training window length, e.g. "12m". */
  train: string;
  /** Test window length (and step), e.g. "3m". */
  test: string;
  /** Training always starts at `from` and grows (instead of sliding). */
  anchored?: boolean;
  /** How the best training run is picked. */
  sort: SortKey;
  /** Training runs with fewer closed trades aren't eligible (unless none are). */
  minTrades?: number;
}

export interface ChosenSetting {
  strategy: string;
  params: Record<string, string>;
  trainReturnPct: number;
  trainMaxDrawdownPct: number;
  trainTrades: number;
}

export interface TestOutcome {
  returnPct: number;
  maxDrawdownPct: number;
  trades: number;
  startEquity: number;
  endEquity: number;
  buyAndHoldReturnPct: number | null;
}

export interface WindowResult {
  index: number;
  trainFrom: Date;
  trainTo: Date;
  testFrom: Date;
  testTo: Date;
  /** Settings tried / eligible (enough trades) on the training period. */
  candidates: number;
  qualified: number;
  /** null when no setting could run on the training period. */
  chosen: ChosenSetting | null;
  test: TestOutcome | null;
}

export interface WalkForwardResult {
  symbols: string[];
  strategies: string[];
  timeframe: string;
  train: Duration;
  test: Duration;
  anchored: boolean;
  sort: SortKey;
  minTrades: number;
  slippageBps: number;
  feePerShare: number;
  cashYieldPct: number;
  /** Interest earned on idle cash during the test windows (included in finalEquity). */
  interestEarned: number;
  /** Out-of-sample span: first test start → last test end. */
  oosFrom: Date;
  oosTo: Date;
  windows: WindowResult[];
  initialCash: number;
  finalEquity: number;
  /** Metrics of the stitched out-of-sample (test) periods. */
  metrics: BacktestMetrics;
  equityCurve: EquityPoint[];
  /** Equal-weight buy & hold over the same out-of-sample span, per equity point. */
  buyAndHold: number[];
  inSampleAnnualPct: number | null;
  outOfSampleAnnualPct: number | null;
  /** Out-of-sample ÷ in-sample annual return, in percent (null if in-sample ≤ 0). */
  efficiencyPct: number | null;
  /** How often the chosen setting changed between windows, and how many distinct ones. */
  paramChanges: number;
  distinctSettings: number;
  fills: Fill[];
}
