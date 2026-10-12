import type { Targets } from './rotation-tranches.js';

/** Trading days in the bear test's window (bearMonths × ~21). */
export const bearWindow = (months: number) => Math.round(months * 21);

/** The market fell over the last `months` (Daniel & Moskowitz's bear-market state; null: not enough data). */
export function marketInBear(market: number[], months: number): boolean | null {
  const n = bearWindow(months);
  if (market.length <= n) return null;
  return (market.at(-1) ?? 0) < (market.at(-1 - n) ?? 0);
}

/**
 * Momentum's worst crashes come in the rebound after a bear market (the
 * past losers jump). In that state, move `cut`% of each stock's weight to the
 * safe asset (or cash without one).
 */
export function cutForBear(
  weights: Targets,
  cut: number,
  safe: string | undefined,
): Targets {
  if (!(cut > 0)) return weights;
  const out: Targets = new Map();
  let moved = 0;
  for (const [s, t] of weights) {
    if (s === safe) continue;
    const keep = t.weight * (1 - cut / 100);
    moved += t.weight - keep;
    out.set(s, { ...t, weight: keep });
  }
  const why = `the market fell over the last 2 years: ${cut}% of the stocks part waits in T-bills (momentum crashes come in the rebound)`;
  const prev = safe ? weights.get(safe) : undefined;
  if (safe && moved + (prev?.weight ?? 0) > 0)
    out.set(safe, {
      weight: (prev?.weight ?? 0) + moved,
      why: prev?.why ?? why,
    });
  return out;
}
