import type { Outcome, ResearchSession } from '../api/research-types';
import type {
  BacktestResponse,
  PortfolioResponse,
  SweepResponse,
  WalkForwardResponse,
} from '../api/types';
import type { BottomLineInput } from './bottomLine';

export function fromBacktest(r: BacktestResponse): BottomLineInput {
  return {
    name: r.strategy,
    symbols: r.symbols,
    from: r.from ?? '',
    to: r.to ?? '',
    startCash: r.initialCash,
    endCash: r.finalEquity,
    holdReturnPct: r.metrics.buyAndHoldReturnPct,
    worstDropPct: r.metrics.maxDrawdownPct,
    holdWorstDropPct: r.holdMaxDrawdownPct,
    trades: r.metrics.trades,
    winRatePct: r.metrics.winRatePct,
    unseen: false,
    interestEarned: r.interestEarned,
  };
}

/** The sweep's top-ranked run (picked with hindsight), or null when nothing ran. */
export function fromSweep(r: SweepResponse): BottomLineInput | null {
  const best = r.top[0];
  if (!best) return null;
  return {
    name: best.label,
    symbols: r.symbols,
    from: r.from ?? '',
    to: r.to ?? '',
    startCash: r.initialCash,
    endCash: r.initialCash * (1 + best.returnPct / 100),
    holdReturnPct: r.buyAndHoldReturnPct,
    worstDropPct: best.maxDrawdownPct,
    holdWorstDropPct: r.holdMaxDrawdownPct,
    trades: best.trades,
    winRatePct: best.winRatePct,
    unseen: false,
    hindsight: true,
  };
}

export function fromWalkForward(r: WalkForwardResponse): BottomLineInput {
  return {
    name: r.strategies.join(' vs '),
    symbols: r.symbols,
    from: r.oosFrom,
    to: r.oosTo,
    startCash: r.initialCash,
    endCash: r.finalEquity,
    holdReturnPct: r.metrics.buyAndHoldReturnPct,
    worstDropPct: r.metrics.maxDrawdownPct,
    holdWorstDropPct: r.holdMaxDrawdownPct,
    trades: r.metrics.trades,
    winRatePct: r.metrics.winRatePct,
    unseen: true,
    interestEarned: r.interestEarned,
  };
}

/** The best idea's run on the hidden holdout, or null before it ran. */
export function fromResearch(s: ResearchSession): BottomLineInput | null {
  const champion = s.experiments.find((e) => e.id === s.championId);
  const o = s.holdout?.outcome;
  if (!o || !champion) return null;
  const cash = s.request.initialCash;
  return {
    name: champion.plan.strategies.join(' + '),
    symbols: s.request.symbols,
    from: o.from,
    to: o.to,
    startCash: cash,
    endCash: cash * (1 + o.returnPct / 100),
    holdReturnPct: o.holdReturnPct,
    worstDropPct: o.maxDrawdownPct,
    holdWorstDropPct: o.holdMaxDrawdownPct,
    trades: o.trades,
    winRatePct: o.winRatePct,
    unseen: true,
  };
}

/** One walk-forward outcome (e.g. one symbol of the multi-symbol check). */
export function fromOutcome(
  name: string,
  symbols: string[],
  o: Outcome,
  cash: number,
): BottomLineInput {
  return {
    name,
    symbols,
    from: o.from,
    to: o.to,
    startCash: cash,
    endCash: cash * (1 + o.returnPct / 100),
    holdReturnPct: o.holdReturnPct,
    worstDropPct: o.maxDrawdownPct,
    holdWorstDropPct: o.holdMaxDrawdownPct,
    trades: o.trades,
    winRatePct: o.winRatePct,
    unseen: true,
  };
}

export function fromPortfolio(r: PortfolioResponse): BottomLineInput {
  return {
    name: `portfolio of ${r.sleeves.length} sleeves`,
    symbols: [...new Set(r.sleeves.flatMap((s) => s.sleeve.symbols))],
    from: r.from ?? '',
    to: r.to ?? '',
    startCash: r.initialCash,
    endCash: r.finalEquity,
    holdReturnPct: r.benchmarkReturnPct,
    worstDropPct: r.metrics.maxDrawdownPct,
    holdWorstDropPct: r.benchmarkMaxDrawdownPct,
    trades: r.metrics.trades,
    winRatePct: r.metrics.winRatePct,
    unseen: false,
    interestEarned: r.interestEarned,
  };
}
