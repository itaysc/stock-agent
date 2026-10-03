import type { Deployment } from '../paper/deployment.types.js';
import type { StrategyBar } from '../strategies/strategy.types.js';
import { openedAt, sellLevels } from './broker-levels.js';
import { holdingStatus, type Ranks } from './broker-status.js';
import { plainReason } from './broker-view.js';
import { INDEX_SYMBOLS } from './profiles.js';
import { SAFE_ASSET } from './universe.js';

/** Closes from a month before the buy to now, at most ~60 points (for the small chart in the row). */
function sparkline(
  bars: StrategyBar[],
  opened: Date | null,
): Array<{ t: string; c: number }> {
  const from = (opened?.getTime() ?? Date.now()) - 30 * 86_400_000;
  const recent = bars.filter((b) => b.timestamp.getTime() >= from);
  const every = Math.max(1, Math.ceil(recent.length / 60));
  return recent
    .filter((_, i) => i % every === 0 || i === recent.length - 1)
    .map((b) => ({
      t: b.timestamp.toISOString().slice(0, 10),
      c: Math.round(b.close * 100) / 100,
    }));
}

/** Where money waits (never ranked, no stop). */
export const SAFE_SYMBOLS = new Set([SAFE_ASSET, INDEX_SYMBOLS[1]]);

/** Every holding of every part (sleeve), with its prices, sell levels and status. */
export function brokerHoldings(
  d: Deployment,
  equity: number,
  history: Record<string, StrategyBar[]>,
  ranks: Ranks | null,
) {
  return d.ledgers
    .flatMap((l, i) =>
      Object.values(l.positions).map((p) => {
        const price = l.lastPrices[p.symbol] ?? p.avgPrice;
        const opened = openedAt(l.trades, p.symbol);
        const safe = SAFE_SYMBOLS.has(p.symbol);
        const index = INDEX_SYMBOLS.includes(p.symbol);
        const auto = sellLevels(
          history[p.symbol] ?? [],
          opened,
          p.avgPrice,
          safe ? {} : d.sleeves[i].params,
        );
        const status =
          index && !safe
            ? {
                stopPrice: null,
                stopIsYours: false,
                takeProfitPrice: d.manual?.[p.symbol]?.takeProfitPrice ?? null,
                takeIsYours: d.manual?.[p.symbol]?.takeProfitPrice != null,
                rank: null,
                tone: 'neutral' as const,
                label: 'S&P 500 part',
                text: 'The calm part: the S&P 500 while it is above its 200-day average, T-bills when it is not.',
              }
            : holdingStatus({
                symbol: p.symbol,
                price,
                autoStop: auto.stopPrice,
                autoTake: auto.takeProfitPrice,
                manual: d.manual?.[p.symbol],
                ranks,
                selling: l.pending.some(
                  (o) => o.symbol === p.symbol && o.side === 'sell',
                ),
                safe,
              });
        return {
          symbol: p.symbol,
          part: index ? ('index' as const) : ('momentum' as const),
          qty: p.qty,
          boughtAt: opened,
          entryPrice: p.avgPrice,
          price,
          highSinceBuy: auto.highSinceBuy,
          spark: sparkline(history[p.symbol] ?? [], opened),
          autoStopPrice: auto.stopPrice,
          ...status,
          value: p.qty * price,
          weightPct: ((p.qty * price) / equity) * 100,
          gainPct: (price / p.avgPrice - 1) * 100,
          why: plainReason(
            l.trades.findLast((t) => t.symbol === p.symbol && t.side === 'buy')
              ?.reason,
          ),
        };
      }),
    )
    .sort((a, b) => b.value - a.value);
}
