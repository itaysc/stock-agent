import {
  buyAndHoldReturnPct,
  maxDrawdownPct,
} from '../backtest/backtest-metrics.js';
import { planGrid, type TestPlan } from '../backtest/plans/test-plan.js';
import { buyAndHoldCurve } from '../backtest/report/report-data.js';
import { annualizedPct } from '../backtest/walkforward/walkforward-metrics.js';
import type { Bars } from '../backtest/walkforward/walkforward.service.js';
import type { WalkForwardRequest } from '../backtest/walkforward/walkforward.types.js';
import { addDuration, parseDuration } from '../backtest/walkforward/windows.js';
import type { Baseline } from './research-prompts.js';
import type { ResearchRequest } from './research.types.js';

/** Bars before `to` (the research period never includes the holdout). */
export const barsBefore = (bars: Bars, to: Date): Bars =>
  Object.fromEntries(
    Object.entries(bars).map(([s, list]) => [
      s,
      list.filter((b) => b.timestamp < to),
    ]),
  );

/** Start of the holdout: `to` minus the holdout length. */
export function holdoutStart(r: Pick<ResearchRequest, 'to' | 'holdout'>): Date {
  const d = parseDuration(r.holdout);
  return addDuration(r.to, { ...d, amount: -d.amount });
}

/**
 * The walk-forward request for a plan. Research: tests fall in [from, researchTo).
 * Holdout: training starts one training length before it, so every test
 * window falls in the holdout.
 */
export function walkForwardRequest(
  plan: TestPlan,
  r: ResearchRequest,
  span: { researchTo: Date; holdout?: boolean },
): WalkForwardRequest {
  const train = parseDuration(plan.train ?? '12m');
  return {
    strategies: plan.strategies,
    grid: planGrid(plan),
    symbols: r.symbols,
    timeframe: r.timeframe,
    from: span.holdout
      ? addDuration(span.researchTo, { ...train, amount: -train.amount })
      : r.from,
    to: span.holdout ? r.to : span.researchTo,
    train: plan.train ?? '12m',
    test: plan.test ?? '3m',
    anchored: plan.anchored ?? false,
    sort: plan.sort,
    minTrades: plan.minTrades,
    initialCash: r.initialCash,
    slippageBps: r.slippageBps,
    feePerShare: r.feePerShare,
    cashYieldPct: r.cashYieldPct,
    newsGateTone: r.newsGateTone,
  };
}

/** Equal-weight buy & hold over the research period, for the agent's context. */
export function baselineOf(
  bars: Bars,
  r: ResearchRequest,
  researchTo: Date,
): Baseline {
  const returnPct = buyAndHoldReturnPct(bars);
  const times = (Object.values(bars)[0] ?? []).map((b) => b.timestamp);
  const curve = buyAndHoldCurve(bars, r.initialCash, times);
  return {
    returnPct,
    annualPct:
      returnPct === null ? null : annualizedPct(returnPct, r.from, researchTo),
    maxDrawdownPct: maxDrawdownPct(
      curve.map((equity, i) => ({ timestamp: times[i], equity })),
    ),
  };
}
