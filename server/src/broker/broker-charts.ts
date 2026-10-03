import type { BacktestService } from '../backtest/backtest.service.js';
import type { Deployment } from '../paper/deployment.types.js';
import type { StrategyBar } from '../strategies/strategy.types.js';
import { openedAt, sellLevels } from './broker-levels.js';
import { plainReason } from './broker-view.js';
import { SAFE_SYMBOLS } from './broker-holdings.js';

const DAY_MS = 86_400_000;
/** The small chart in each holding row starts this many days before the buy. */
export const SPARK_DAYS_BEFORE = 30;

const daily = async (
  backtests: BacktestService,
  symbols: string[],
  from: Date,
): Promise<Record<string, StrategyBar[]>> =>
  symbols.length
    ? backtests.fetchBars(symbols, { timeframe: '1Day', from, to: new Date() })
    : {};

/** Daily bars of each holding since it was bought (for its stop level). */
export async function holdingHistory(
  backtests: BacktestService,
  d: Deployment,
): Promise<Record<string, StrategyBar[]>> {
  const held = d.ledgers.flatMap((l) =>
    Object.keys(l.positions)
      .filter((s) => !SAFE_SYMBOLS.has(s))
      .map((s) => ({
        s,
        opened: openedAt(l.trades, s)?.getTime() ?? Date.now(),
      })),
  );
  const opened = held.map((h) => h.opened);
  return daily(
    backtests,
    held.map((h) => h.s),
    // From a month before the first buy: the stop levels, and each row's small chart.
    new Date(Math.min(Date.now(), ...opened) - SPARK_DAYS_BEFORE * DAY_MS),
  );
}

/** One stock's chart: closes from 3 months before the buy, its trades, and its levels. */
export async function stockChart(
  backtests: BacktestService,
  d: Deployment | null,
  symbol: string,
) {
  // The part (sleeve) that trades this symbol.
  const sleeve = d
    ? Math.max(
        0,
        d.ledgers.findIndex(
          (x) =>
            x.positions[symbol] || x.trades.some((t) => t.symbol === symbol),
        ),
      )
    : 0;
  const l = d?.ledgers[sleeve];
  const position = l?.positions[symbol];
  const opened = l ? openedAt(l.trades, symbol) : null;
  const start = new Date((opened ?? new Date()).getTime() - 90 * DAY_MS);
  const bars = (await daily(backtests, [symbol], start))[symbol] ?? [];
  const auto =
    d && position && !SAFE_SYMBOLS.has(symbol)
      ? sellLevels(bars, opened, position.avgPrice, d.sleeves[sleeve].params)
      : null;
  // Your own levels count too: the higher stop, and your target over the automatic one.
  const mine = d?.manual?.[symbol];
  const levels = auto && {
    highSinceBuy: auto.highSinceBuy,
    stopPrice: Math.max(auto.stopPrice ?? 0, mine?.stopPrice ?? 0) || null,
    takeProfitPrice: mine?.takeProfitPrice ?? auto.takeProfitPrice,
  };
  return {
    symbol,
    closes: bars.map((b) => ({ time: b.timestamp, close: b.close })),
    trades: (l?.trades ?? [])
      .filter((t) => t.symbol === symbol && new Date(t.timestamp) >= start)
      .map((t) => ({
        time: t.timestamp,
        side: t.side,
        qty: t.qty,
        price: t.price,
        why: plainReason(t.reason),
      })),
    entryPrice: position?.avgPrice ?? null,
    boughtAt: opened,
    ...(levels ?? {
      highSinceBuy: null,
      stopPrice: null,
      takeProfitPrice: null,
    }),
  };
}

/** SPY's return since a date (to compare with), or null without data. */
export async function spySince(
  backtests: BacktestService,
  from: Date,
): Promise<number | null> {
  const bars =
    (
      await daily(
        backtests,
        ['SPY'],
        new Date(new Date(from).getTime() - 4 * DAY_MS),
      )
    )['SPY'] ?? [];
  const start =
    bars.filter((b) => b.timestamp <= new Date(from)).at(-1) ?? bars[0];
  const end = bars.at(-1);
  return start && end ? (end.close / start.close - 1) * 100 : null;
}
