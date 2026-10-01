import type { LedgerTrade } from '../paper/deployment.types.js';
import type { StrategyBar } from '../strategies/strategy.types.js';
import { cleanQty } from '../strategies/qty.js';

/** When the current position in `symbol` was opened (its first buy since it was last empty). */
export function openedAt(trades: LedgerTrade[], symbol: string): Date | null {
  let qty = 0;
  let opened: Date | null = null;
  for (const t of trades.filter((x) => x.symbol === symbol)) {
    if (t.side === 'buy' && qty <= 0) opened = new Date(t.timestamp);
    qty = cleanQty(qty + (t.side === 'buy' ? t.qty : -t.qty));
    if (qty <= 0) opened = null;
  }
  return opened;
}

/**
 * Its sell levels: the trailing stop (stopPct below the highest close since
 * it was bought) and the take-profit (takeProfitPct above the buy price).
 */
export function sellLevels(
  bars: StrategyBar[],
  opened: Date | null,
  entryPrice: number,
  params: Record<string, string>,
): {
  highSinceBuy: number;
  stopPrice: number | null;
  takeProfitPrice: number | null;
} {
  const since = bars.filter((b) => !opened || b.timestamp >= opened);
  const highSinceBuy = Math.max(entryPrice, ...since.map((b) => b.close));
  const stop = Number(params.stopPct ?? 0);
  const take = Number(params.takeProfitPct ?? 0);
  return {
    highSinceBuy,
    stopPrice: stop > 0 ? highSinceBuy * (1 - stop / 100) : null,
    takeProfitPrice: take > 0 ? entryPrice * (1 + take / 100) : null,
  };
}
