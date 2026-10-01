import type { BacktestService } from '../backtest/backtest.service.js';
import type { Deployment } from '../paper/deployment.types.js';
import type { StrategyBar } from '../strategies/strategy.types.js';
import { openedAt, sellLevels } from './broker-levels.js';
import { plainReason } from './broker-view.js';
import { SAFE_ASSET } from './universe.js';

const DAY_MS = 86_400_000;

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
  const l = d.ledgers[0];
  const held = Object.keys(l.positions).filter((s) => s !== SAFE_ASSET);
  const opened = held.map(
    (s) => openedAt(l.trades, s)?.getTime() ?? Date.now(),
  );
  return daily(
    backtests,
    held,
    new Date(Math.min(Date.now(), ...opened) - 3 * DAY_MS),
  );
}

/** One stock's chart: closes from 3 months before the buy, its trades, and its levels. */
export async function stockChart(
  backtests: BacktestService,
  d: Deployment | null,
  symbol: string,
) {
  const l = d?.ledgers[0];
  const position = l?.positions[symbol];
  const opened = l ? openedAt(l.trades, symbol) : null;
  const start = new Date((opened ?? new Date()).getTime() - 90 * DAY_MS);
  const bars = (await daily(backtests, [symbol], start))[symbol] ?? [];
  const auto =
    d && position && symbol !== SAFE_ASSET
      ? sellLevels(bars, opened, position.avgPrice, d.sleeves[0].params)
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
