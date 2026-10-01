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
  const levels =
    d && position && symbol !== SAFE_ASSET
      ? sellLevels(bars, opened, position.avgPrice, d.sleeves[0].params)
      : null;
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
