import type { BacktestService } from '../backtest/backtest.service.js';
import { MomentumRotationStrategy } from '../strategies/rotation/momentum-rotation.strategy.js';
import { roundQty } from '../strategies/qty.js';
import { createStrategy } from '../strategies/strategy-registry.js';
import { plainReason } from './broker-view.js';
import { BROKER_STOCKS, DEFAULT_PARAMS, SAFE_ASSET } from './universe.js';

const DAY_MS = 86_400_000;

export interface PlanRow {
  symbol: string;
  /** Share of the money. */
  weightPct: number;
  amount: number;
  qty: number;
  /** Latest close (it buys at the next open, so the price will differ a little). */
  price: number;
  /** The first stop: it rises with the highest close after the buy. */
  stopPrice: number | null;
  why: string;
}

/**
 * What the broker would buy now with `capital`: the algo run on the latest
 * year and a half of closes, its targets turned into amounts and shares.
 */
/** The algo warmed up on the latest completed year and a half of closes, as of `cutoff`. */
export async function rankNow(backtests: BacktestService, cutoff: Date) {
  const symbols = [...BROKER_STOCKS, SAFE_ASSET];
  // Day-rounded: the same range (and the cached prices) all day.
  const from = new Date(cutoff.getTime() - 520 * DAY_MS);
  from.setUTCHours(0, 0, 0, 0);
  const bars = await backtests.fetchBars(symbols, {
    timeframe: '1Day',
    from,
    to: cutoff,
  });
  const strategy = createStrategy('momentum-rotation', symbols, DEFAULT_PARAMS);
  if (!(strategy instanceof MomentumRotationStrategy))
    throw new Error('Unexpected strategy');
  for (const s of Object.keys(bars))
    bars[s] = bars[s].filter((b) => b.timestamp < cutoff);
  const all = Object.values(bars)
    .flat()
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  for (const bar of all) strategy.onBar(bar);
  if (!strategy.ready)
    throw new Error('Not enough price history yet to rank the stocks');
  return { strategy, bars, asOf: all.at(-1)?.timestamp ?? cutoff };
}

/** Each stock's rank now (1 = strongest) and whether the algo would hold it. */
export async function currentRanks(backtests: BacktestService, cutoff: Date) {
  const { strategy } = await rankNow(backtests, cutoff);
  const targets = strategy.targets();
  return {
    total: BROKER_STOCKS.length,
    rank: Object.fromEntries(
      strategy.ranking().map((s, i) => [s, i + 1]),
    ) as Record<string, number>,
    wanted: [...targets.keys()],
  };
}

export async function previewPlan(
  backtests: BacktestService,
  capital: number,
  /** Bars dated before this are complete (today's is still forming while the market is open). */
  cutoff: Date,
): Promise<{ capital: number; asOf: Date; rows: PlanRow[]; cash: number }> {
  const { strategy, bars, asOf } = await rankNow(backtests, cutoff);
  const last = (s: string) => bars[s]?.at(-1)?.close ?? 0;
  const stop = Number(DEFAULT_PARAMS.stopPct);
  const rows = [...strategy.targets().entries()]
    .map(([symbol, t]) => {
      const amount = capital * t.weight;
      const price = last(symbol);
      return {
        symbol,
        weightPct: t.weight * 100,
        amount,
        qty: roundQty(amount / price, true),
        price,
        stopPrice:
          symbol === SAFE_ASSET || !(stop > 0)
            ? null
            : price * (1 - stop / 100),
        why: plainReason(t.why),
      };
    })
    .filter((r) => r.qty > 0)
    .sort((a, b) => b.amount - a.amount);
  return {
    capital,
    asOf,
    rows,
    cash: capital - rows.reduce((n, r) => n + r.qty * r.price, 0),
  };
}
