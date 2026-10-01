import type { Strategy, StrategyBar } from '../../strategies/strategy.types.js';
import { BacktestStepper } from '../backtest-stepper.js';
import {
  computeMetrics,
  type EquityPoint,
  maxDrawdownPct,
} from '../backtest-metrics.js';
import { buyAndHoldCurve } from '../report/report-data.js';
import type { BrokerOptions } from '../simulated-broker.js';
import { buildTimeline } from '../timeline.js';
import { correlationMatrix } from './correlation.js';
import type {
  PortfolioResult,
  PortfolioRisk,
  Sleeve,
  SleeveResult,
  StopEvent,
} from './portfolio.types.js';

type Bars = Record<string, StrategyBar[]>;
const DAY_MS = 86_400_000;
const YEAR_MS = 365.25 * DAY_MS;

export interface PortfolioPart {
  sleeve: Sleeve;
  label: string;
  strategy: Strategy;
}

const pick = (bars: Bars, symbols: string[]): Bars =>
  Object.fromEntries(symbols.map((s) => [s, bars[s] ?? []]));

/**
 * Runs every sleeve on its own simulated account with its share of the cash,
 * all on one shared clock, and watches the whole portfolio: when it falls
 * `risk.maxDrawdownPct` below its peak, every sleeve sells everything and
 * makes no new buys for `risk.cooldownDays`.
 */
export function runPortfolio(
  parts: PortfolioPart[],
  bars: Bars,
  options: BrokerOptions,
  risk: PortfolioRisk,
  market: Bars = {},
): PortfolioResult {
  const cash = options.initialCash;
  const accounts = parts.map((part) => {
    const allocated = (cash * part.sleeve.weightPct) / 100;
    return {
      part,
      allocated,
      bars: pick(bars, part.sleeve.symbols),
      stepper: new BacktestStepper(
        part.strategy,
        pick(bars, part.sleeve.symbols),
        { ...options, initialCash: allocated },
        { market },
      ),
    };
  });
  const reserveStart = cash - accounts.reduce((n, a) => n + a.allocated, 0);
  let reserve = reserveStart;
  const rate = (options.cashYieldPct ?? 0) / 100;

  const timeline = buildTimeline(
    Object.fromEntries(accounts.flatMap((a) => Object.entries(a.bars))),
  );
  const curve: EquityPoint[] = [];
  const sleeveCurves: number[][] = accounts.map(() => []);
  const stops: StopEvent[] = [];
  let peak = cash;
  let pausedUntil: Date | null = null;
  let previous: Date | null = null;

  for (const { timestamp: t } of timeline) {
    for (const a of accounts) a.stepper.step(t);
    if (previous && rate > 0) {
      reserve *= (1 + rate) ** ((t.getTime() - previous.getTime()) / YEAR_MS);
    }
    previous = t;
    let equity = reserve + accounts.reduce((n, a) => n + a.stepper.equity(), 0);
    peak = Math.max(peak, equity);
    const drawdown = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    const paused = pausedUntil !== null && t < pausedUntil;
    if (risk.maxDrawdownPct > 0 && !paused && drawdown >= risk.maxDrawdownPct) {
      const resumesAt = new Date(t.getTime() + risk.cooldownDays * DAY_MS);
      for (const a of accounts) {
        a.stepper.closeOut('portfolio stop');
        a.stepper.pause(resumesAt);
      }
      equity = reserve + accounts.reduce((n, a) => n + a.stepper.equity(), 0);
      stops.push({ timestamp: t, drawdownPct: drawdown, equity, resumesAt });
      pausedUntil = resumesAt;
      peak = equity; // measure the next drawdown from here
    }
    curve.push({ timestamp: t, equity });
    accounts.forEach((a, i) => sleeveCurves[i].push(a.stepper.equity()));
  }

  const times = curve.map((p) => p.timestamp);
  const benchmark = times.map(() => 0);
  accounts.forEach((a) => {
    buyAndHoldCurve(a.bars, a.allocated, times).forEach(
      (v, i) => (benchmark[i] += v),
    );
  });
  // The reserve is cash in both: it grows the same way in the benchmark.
  const reserveCurve = times.map(
    (t) =>
      reserveStart *
      (1 + rate) ** ((t.getTime() - (times[0]?.getTime() ?? 0)) / YEAR_MS),
  );
  reserveCurve.forEach((v, i) => (benchmark[i] += v));

  const sleeves: SleeveResult[] = accounts.map((a) => {
    const result = a.stepper.result();
    return {
      sleeve: a.part.sleeve,
      label: a.part.label,
      allocated: a.allocated,
      result,
      contribution: result.finalEquity - a.allocated,
      holdReturnPct: result.metrics.buyAndHoldReturnPct,
    };
  });
  const finalEquity = curve.at(-1)?.equity ?? cash;
  const benchmarkEnd = benchmark.at(-1);
  const metrics = computeMetrics(
    cash,
    curve,
    sleeves.flatMap((s) => s.result.fills),
    pick(bars, []),
  );
  return {
    from: times[0],
    to: times.at(-1),
    initialCash: cash,
    finalEquity,
    reserve: { allocated: reserveStart, final: reserve },
    metrics: {
      ...metrics,
      buyAndHoldReturnPct:
        benchmarkEnd === undefined ? null : (benchmarkEnd / cash - 1) * 100,
    },
    equityCurve: curve,
    benchmark,
    benchmarkReturnPct:
      benchmarkEnd === undefined ? null : (benchmarkEnd / cash - 1) * 100,
    benchmarkMaxDrawdownPct: maxDrawdownPct(
      benchmark.map((equity, i) => ({ timestamp: times[i], equity })),
    ),
    interestEarned:
      sleeves.reduce((n, s) => n + s.result.interestEarned, 0) +
      (reserve - reserveStart),
    sleeves,
    correlation: correlationMatrix(sleeveCurves),
    stops,
    risk,
  };
}
