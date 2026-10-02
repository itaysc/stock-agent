import type { StrategyContext } from '../strategy.types.js';

type Params = Record<string, number>;

/** Every day: the stop loss (trailing: below the highest close since bought) and the take-profit. */
export function holdingExits(
  p: Params,
  symbols: string[],
  closes: Map<string, number[]>,
  peaks: Map<string, number>,
  ctx: StrategyContext,
): Set<string> {
  const stopped = new Set<string>();
  for (const s of symbols) {
    const close = closes.get(s)?.at(-1);
    if (!ctx.position(s) || close === undefined) {
      peaks.delete(s);
      continue;
    }
    const peak = Math.max(peaks.get(s) ?? close, close);
    peaks.set(s, peak);
    const drop = (1 - close / peak) * 100;
    const gain = (close / (ctx.position(s)?.avgPrice ?? close) - 1) * 100;
    const safe = p.safeLast && s === symbols.at(-1);
    if (p.takeProfitPct > 0 && !safe && gain >= p.takeProfitPct) {
      ctx.sell(
        s,
        ctx.position(s)?.qty ?? 0,
        `take profit: up ${gain.toFixed(1)}% from the buy price`,
      );
      peaks.delete(s);
      stopped.add(s);
      continue;
    }
    if (p.stopPct > 0 && !safe && drop >= p.stopPct) {
      ctx.sell(
        s,
        ctx.position(s)?.qty ?? 0,
        `stop: down ${drop.toFixed(1)}% from its high`,
      );
      peaks.delete(s);
      stopped.add(s);
    }
  }
  return stopped;
}
