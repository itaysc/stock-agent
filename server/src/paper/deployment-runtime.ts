import { createStrategy } from '../strategies/strategy-registry.js';
import type { Strategy, StrategyBar } from '../strategies/strategy.types.js';
import type { Deployment } from './deployment.types.js';
import { SleeveContext } from './sleeve-context.js';

type Bars = Record<string, StrategyBar[]>;

/** The in-memory side of a running deployment: one strategy instance per sleeve. */
export interface Runtime {
  sleeves: Array<{ strategy: Strategy; context: SleeveContext }>;
  /** True once the strategies have seen the history up to lastBarAt. */
  warmed: boolean;
}

export function createRuntime(d: Deployment): Runtime {
  return {
    warmed: false,
    sleeves: d.sleeves.map((s, i) => ({
      strategy: createStrategy(s.strategy, s.symbols, s.params),
      context: new SleeveContext(d.ledgers[i]),
    })),
  };
}

/** Calendar days of daily history the strategies need before they can trade. */
export function warmupDays(runtime: Runtime): number {
  const bars = Math.max(
    0,
    ...runtime.sleeves.map((s) => s.strategy.warmupBars ?? 0),
  );
  return Math.ceil(bars * 1.5) + 10;
}

/** Symbols to fetch: every traded symbol plus market data (e.g. SPY). */
export function symbolsToFetch(runtime: Runtime): {
  traded: string[];
  market: string[];
} {
  const traded = [
    ...new Set(runtime.sleeves.flatMap((s) => s.strategy.symbols)),
  ];
  const market = [
    ...new Set(runtime.sleeves.flatMap((s) => s.strategy.marketSymbols ?? [])),
  ];
  return { traded, market };
}

/**
 * Feeds bars in time order: market bars first, then each sleeve's own bars.
 * Orders are only taken on bars at `tradeAt` (the latest completed day);
 * earlier bars just update the indicators and prices.
 */
export function feed(
  d: Deployment,
  runtime: Runtime,
  bars: Bars,
  market: Bars,
  tradeAt: Date | null,
  /** Called after each time step (e.g. to record the equity at that close). */
  onStep?: (t: Date) => void,
): void {
  const times = [
    ...new Set(
      [...Object.values(bars), ...Object.values(market)]
        .flat()
        .map((b) => b.timestamp.getTime()),
    ),
  ].sort((a, b) => a - b);
  const at = (list: Bars, t: number) =>
    Object.values(list).flatMap((l) =>
      l.filter((b) => b.timestamp.getTime() === t),
    );
  for (const t of times) {
    const trading = tradeAt !== null && t === tradeAt.getTime();
    for (const bar of at(market, t))
      runtime.sleeves.forEach((s) => s.strategy.onMarketBar?.(bar));
    runtime.sleeves.forEach((s, i) => {
      s.context.acceptingOrders = trading && d.status === 'active';
      s.context.setTime(new Date(t));
      for (const bar of at(bars, t)) {
        if (!s.strategy.symbols.includes(bar.symbol)) continue;
        d.ledgers[i].lastPrices[bar.symbol] = bar.close;
        s.strategy.onBar(bar, s.context);
      }
      if (at(bars, t).some((b) => s.strategy.symbols.includes(b.symbol))) {
        s.context.acceptingOrders = trading && d.status === 'active';
        s.strategy.onClose?.(new Date(t), s.context);
      }
      s.context.acceptingOrders = false;
    });
    onStep?.(new Date(t));
  }
}
