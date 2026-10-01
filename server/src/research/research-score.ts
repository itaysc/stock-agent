import { maxDrawdownPct } from '../backtest/backtest-metrics.js';
import { annualizedPct } from '../backtest/walkforward/walkforward-metrics.js';
import type { WalkForwardResult } from '../backtest/walkforward/walkforward.types.js';
import type { Experiment, Outcome, ResearchGoal } from './research.types.js';

/** Fewer closed trades than this on unseen data is weak evidence. */
export const MIN_TRADES = 8;
/** Drawdowns under this count as this much (so a quiet test can't win on a tiny drawdown). */
const DD_FLOOR = 5;

export const GOAL_TEXT: Record<ResearchGoal, string> = {
  'risk-adjusted':
    'best return per unit of risk: annualized return ÷ max drawdown, minus the same ratio for buy & hold (above 0 = better risk/reward than holding)',
  'beat-hold':
    'beat buy & hold: annualized return minus buy & hold’s annualized return over the same unseen periods',
  return: 'highest annualized return on the unseen periods',
};

export function outcomeOf(r: WalkForwardResult): Outcome {
  const hold = r.metrics.buyAndHoldReturnPct;
  const last = r.windows.findLast((w) => w.chosen)?.chosen;
  return {
    from: r.oosFrom,
    to: r.oosTo,
    returnPct: r.metrics.totalReturnPct,
    holdReturnPct: hold,
    annualPct: r.outOfSampleAnnualPct,
    holdAnnualPct:
      hold === null ? null : annualizedPct(hold, r.oosFrom, r.oosTo),
    maxDrawdownPct: r.metrics.maxDrawdownPct,
    holdMaxDrawdownPct: maxDrawdownPct(
      r.buyAndHold.map((equity, i) => ({
        timestamp: r.equityCurve[i].timestamp,
        equity,
      })),
    ),
    trades: r.metrics.trades,
    winRatePct: r.metrics.winRatePct,
    profitFactor: r.metrics.profitFactor,
    efficiencyPct: r.efficiencyPct,
    windows: r.windows.length,
    distinctSettings: r.distinctSettings,
    paramChanges: r.paramChanges,
    latestPick: last ? { strategy: last.strategy, params: last.params } : null,
  };
}

/** Higher is better; see GOAL_TEXT. */
export function scoreOf(goal: ResearchGoal, o: Outcome): number {
  const annual = o.annualPct ?? 0;
  const hold = o.holdAnnualPct ?? 0;
  const value =
    goal === 'return'
      ? annual
      : goal === 'beat-hold'
        ? annual - hold
        : annual / Math.max(o.maxDrawdownPct, DD_FLOOR) -
          hold / Math.max(o.holdMaxDrawdownPct, DD_FLOOR);
  return Number(value.toFixed(3));
}

/** Tests that ran, best first: enough trades before weak evidence, then by score. */
export function ranked(experiments: Experiment[]): Experiment[] {
  return experiments
    .filter((e) => e.score !== undefined)
    .sort(
      (a, b) =>
        Number(a.weak ?? false) - Number(b.weak ?? false) ||
        (b.score ?? 0) - (a.score ?? 0),
    );
}
