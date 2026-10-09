import type {
  Strategy,
  StrategyBar,
  StrategyContext,
} from '../strategies/strategy.types.js';
import type { BacktestResult } from './backtest-engine.js';
import { computeMetrics, type EquityPoint } from './backtest-metrics.js';
import { type BrokerOptions, SimulatedBroker } from './simulated-broker.js';
import { buildTimeline } from './timeline.js';

export interface StepperOptions {
  /** Earlier bars only warm the strategy up (its orders are ignored). */
  startAt?: Date;
  /** Bars of the strategy's marketSymbols (read, never traded). */
  market?: Record<string, StrategyBar[]>;
}

/**
 * One strategy on one simulated account, advanced one timestamp at a time, so
 * several can run side by side on a shared clock (a portfolio). For each
 * timestamp it has bars for:
 * 1. idle cash earns interest up to now, and orders from earlier bars fill at this bar's open,
 * 2. positions are marked at this bar's close,
 * 3. the strategy sees the (closed) bar and may place orders for the next one,
 * 4. onClose runs once all of that time's bars are in (e.g. to rebalance).
 */
export class BacktestStepper {
  readonly broker: SimulatedBroker;
  readonly equityCurve: EquityPoint[] = [];
  private readonly byTime: Map<number, StrategyBar[]>;
  private readonly deliverMarket: (until: Date) => void;
  private readonly lastBars = new Map<string, StrategyBar>();
  private readonly readOnly: StrategyContext;
  private pausedUntil: Date | null = null;
  private harvestedYear: number | null = null;

  constructor(
    private readonly strategy: Strategy,
    private readonly barsBySymbol: Record<string, StrategyBar[]>,
    private readonly options: BrokerOptions,
    private readonly opts: StepperOptions = {},
  ) {
    this.broker = new SimulatedBroker(options);
    this.byTime = new Map(
      buildTimeline(barsBySymbol).map((s) => [s.timestamp.getTime(), s.bars]),
    );
    this.deliverMarket = marketFeed(strategy, opts.market ?? {});
    this.readOnly = readOnlyContext(this.broker);
  }

  /** Processes one timestamp (does nothing for the account if it has no bars then). */
  step(t: Date): void {
    const bars = this.byTime.get(t.getTime()) ?? [];
    this.broker.setTime(t);
    this.deliverMarket(t);
    if (this.opts.startAt && t < this.opts.startAt) {
      for (const bar of bars) this.strategy.onBar(bar, this.readOnly);
      if (bars.length) this.strategy.onClose?.(t, this.readOnly);
      return;
    }
    if (bars.length === 0) return;
    this.broker.accrueInterest(t);
    // Sells first, so their cash can pay for buys at the same open (like a real account).
    for (const side of ['sell', 'buy'] as const) {
      for (const bar of bars) {
        for (const fill of this.broker.fillPending(bar, side)) {
          this.strategy.onFill?.(fill, this.broker);
        }
      }
    }
    for (const bar of bars) {
      this.broker.markPrice(bar);
      this.lastBars.set(bar.symbol, bar);
    }
    const paused = this.pausedUntil !== null && t < this.pausedUntil;
    for (const bar of bars) {
      this.strategy.onBar(bar, paused ? this.readOnly : this.broker);
    }
    this.strategy.onClose?.(t, paused ? this.readOnly : this.broker);
    // fillAtClose: today's orders fill in today's closing auction (sells first, as at the open).
    if (this.options.fillAtClose)
      for (const side of ['sell', 'buy'] as const)
        for (const bar of bars)
          for (const fill of this.broker.fillPending(
            { ...bar, open: bar.close },
            side,
          ))
            this.strategy.onFill?.(fill, this.broker);
    // Tax-loss harvesting: once a year, on the first trading day from December 20.
    const year = t.getUTCFullYear();
    if (
      this.options.harvestLosses &&
      t.getUTCMonth() === 11 &&
      t.getUTCDate() >= 20 &&
      this.harvestedYear !== year
    ) {
      this.harvestedYear = year;
      this.broker.harvestLosses();
    }
    this.equityCurve.push({ timestamp: t, equity: this.broker.equity() });
  }

  /** Sells every open position at its last close (slippage and fees included); pending orders are dropped. */
  closeOut(reason: string): void {
    this.broker.cancelPending();
    for (const bar of this.lastBars.values()) {
      const held = this.broker.position(bar.symbol);
      if (!held) continue;
      this.broker.sell(bar.symbol, held.qty, reason);
      this.broker.fillPending({ ...bar, open: bar.close });
    }
    const last = this.equityCurve.at(-1);
    if (last) last.equity = this.broker.equity();
  }

  /** Ignores the strategy's orders until `until` (it still sees every bar). */
  pause(until: Date): void {
    this.broker.cancelPending();
    this.pausedUntil = until;
  }

  equity(): number {
    return this.broker.equity();
  }

  result(): BacktestResult {
    const broker = this.broker;
    const curve = this.equityCurve;
    const startAt = this.opts.startAt;
    return {
      strategy: this.strategy.name,
      symbols: this.strategy.symbols,
      from: curve[0]?.timestamp,
      to: curve.at(-1)?.timestamp,
      bars: curve.length,
      initialCash: this.options.initialCash,
      finalEquity: broker.equity(),
      metrics: computeMetrics(
        this.options.initialCash,
        curve,
        broker.fills,
        startAt ? tradedBars(this.barsBySymbol, startAt) : this.barsBySymbol,
      ),
      fills: broker.fills,
      rejections: broker.rejections,
      interestEarned: broker.interestEarned(),
      taxPaid: broker.taxPaid(),
      afterTaxEquity: broker.afterTaxEquity(),
      unfilledOrders: broker.pendingOrders().length,
      openPositions: broker.openPositions(),
      equityCurve: curve,
    };
  }
}

/** Hands the strategy every market bar up to (and including) a time, once, in order. */
function marketFeed(
  strategy: Strategy,
  market: Record<string, StrategyBar[]>,
): (until: Date) => void {
  const wanted = strategy.marketSymbols ?? [];
  const bars = buildTimeline(
    Object.fromEntries(wanted.map((s) => [s, market[s] ?? []])),
  ).flatMap((step) => step.bars);
  let next = 0;
  return (until) => {
    while (next < bars.length && bars[next].timestamp <= until) {
      strategy.onMarketBar?.(bars[next++]);
    }
  };
}

/** The broker as the strategy sees it, with buy/sell ignored (for warm-up). */
function readOnlyContext(broker: SimulatedBroker): StrategyContext {
  return {
    now: () => broker.now(),
    cash: () => broker.cash(),
    position: (symbol) => broker.position(symbol),
    buy: () => undefined,
    sell: () => undefined,
  };
}

function tradedBars(
  barsBySymbol: Record<string, StrategyBar[]>,
  startAt: Date,
): Record<string, StrategyBar[]> {
  return Object.fromEntries(
    Object.entries(barsBySymbol).map(([s, bars]) => [
      s,
      bars.filter((b) => b.timestamp >= startAt),
    ]),
  );
}
