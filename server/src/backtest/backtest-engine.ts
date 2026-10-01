import type {
  Fill,
  Position,
  Strategy,
  StrategyBar,
} from '../strategies/strategy.types.js';
import { BacktestStepper, type StepperOptions } from './backtest-stepper.js';
import type { BacktestMetrics, EquityPoint } from './backtest-metrics.js';
import type { BrokerOptions, Rejection } from './simulated-broker.js';
import { buildTimeline } from './timeline.js';

export { buildTimeline } from './timeline.js';

/**
 * Version of the simulation rules (fills, slippage/fees, metrics, timeline).
 * Bump it whenever they change: saved backtests from older versions are then
 * treated as stale and re-run.
 */
export const ENGINE_VERSION = 4; // v4: sells fill before buys at the same open; onClose (v3: interest on idle cash, v2: reduced buys)

export interface BacktestResult {
  strategy: string;
  symbols: string[];
  from?: Date;
  to?: Date;
  bars: number;
  initialCash: number;
  finalEquity: number;
  metrics: BacktestMetrics;
  fills: Fill[];
  rejections: Rejection[];
  /** Interest paid on idle cash (see BrokerOptions.cashYieldPct), included in finalEquity. */
  interestEarned: number;
  /** Orders placed on the last bar, which never got a next bar to fill on. */
  unfilledOrders: number;
  openPositions: Position[];
  equityCurve: EquityPoint[];
}

/**
 * Replays historical bars through a strategy. For each timestamp:
 * 1. idle cash earns interest up to now, and orders from earlier bars fill at this bar's open,
 * 2. positions are marked at this bar's close,
 * 3. the strategy sees the (closed) bar and may place orders for the next one.
 *
 * With `startAt`, earlier bars only warm the strategy up (its indicators see
 * them, its orders are ignored); trading and all results start at `startAt`.
 * With `closeAtEnd`, positions still open after the last bar are sold at its
 * close (with slippage and fees), so every trade is closed and counted.
 * `market`: bars of the strategy's marketSymbols (read, never traded); each one
 * reaches onMarketBar before the traded bars of its time, never later ones.
 */
export function runBacktest(
  strategy: Strategy,
  barsBySymbol: Record<string, StrategyBar[]>,
  options: BrokerOptions,
  { closeAtEnd, ...stepper }: StepperOptions & { closeAtEnd?: boolean } = {},
): BacktestResult {
  const run = new BacktestStepper(strategy, barsBySymbol, options, stepper);
  for (const step of buildTimeline(barsBySymbol)) run.step(step.timestamp);
  if (closeAtEnd) run.closeOut('test window ended');
  return run.result();
}
