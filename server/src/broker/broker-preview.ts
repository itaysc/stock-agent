import type { BacktestService } from '../backtest/backtest.service.js';
import { MomentumRotationStrategy } from '../strategies/rotation/momentum-rotation.strategy.js';
import { roundQty } from '../strategies/qty.js';
import { createStrategy } from '../strategies/strategy-registry.js';
import { plainReason } from './broker-view.js';
import { INDEX_SYMBOLS, type Profile } from './profiles.js';
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

/** The algo warmed up on the latest completed year and a half of closes, as of `cutoff`. */
export async function rankNow(
  backtests: BacktestService,
  cutoff: Date,
  symbols: string[] = [...BROKER_STOCKS, SAFE_ASSET],
  params: Record<string, string> = DEFAULT_PARAMS,
) {
  // Day-rounded: the same range (and the cached prices) all day.
  const from = new Date(cutoff.getTime() - 520 * DAY_MS);
  from.setUTCHours(0, 0, 0, 0);
  const strategy = createStrategy('momentum-rotation', symbols, params);
  if (!(strategy instanceof MomentumRotationStrategy))
    throw new Error('Unexpected strategy');
  const market = strategy.marketSymbols ?? [];
  const bars = await backtests.fetchBars(
    [...new Set([...symbols, ...market])],
    { timeframe: '1Day', from, to: cutoff },
  );
  for (const s of Object.keys(bars))
    bars[s] = bars[s].filter((b) => b.timestamp < cutoff);
  const all = Object.values(bars)
    .flat()
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  for (const bar of all) {
    if (market.includes(bar.symbol)) strategy.onMarketBar(bar);
    if (symbols.includes(bar.symbol)) strategy.onBar(bar);
  }
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

/** What the profile would buy now with `capital`: each part's targets, as amounts and shares. */
export async function previewPlan(
  backtests: BacktestService,
  capital: number,
  /** Bars dated before this are complete (today's is still forming while the market is open). */
  cutoff: Date,
  profile: Profile,
): Promise<{ capital: number; asOf: Date; rows: PlanRow[]; cash: number }> {
  const rows: PlanRow[] = [];
  let asOf = cutoff;
  for (const sleeve of profile.sleeves) {
    const index = sleeve.kind === 'index';
    const symbols = index ? INDEX_SYMBOLS : [...BROKER_STOCKS, SAFE_ASSET];
    const {
      strategy,
      bars,
      asOf: at,
    } = await rankNow(backtests, cutoff, symbols, sleeve.params);
    asOf = at;
    const stop = Number(sleeve.params.stopPct ?? 0);
    for (const [symbol, t] of strategy.targets()) {
      const amount = (capital * sleeve.weightPct * t.weight) / 100;
      const price = bars[symbol]?.at(-1)?.close ?? 0;
      const safe = symbol === SAFE_ASSET || symbol === INDEX_SYMBOLS[1];
      const why = !index
        ? plainReason(t.why)
        : safe
          ? 'T-bills: the S&P 500 is below its 200-day average'
          : 'the S&P 500 part (the market is above its 200-day average)';
      rows.push({
        symbol,
        weightPct: sleeve.weightPct * t.weight,
        amount,
        qty: price > 0 ? roundQty(amount / price, true) : 0,
        price,
        stopPrice:
          safe || index || !(stop > 0) ? null : price * (1 - stop / 100),
        why,
      });
    }
  }
  const kept = rows
    .filter((r) => r.qty > 0)
    .sort((a, b) => b.amount - a.amount);
  return {
    capital,
    asOf,
    rows: kept,
    cash: capital - kept.reduce((n, r) => n + r.qty * r.price, 0),
  };
}
