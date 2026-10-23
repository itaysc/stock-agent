import type { Targets } from './rotation-tranches.js';

/**
 * What you decided by hand, for the live runner to pass on: stocks you sold
 * (not picked while they wait; the next in line takes their place) and slots
 * you left empty (they wait in the safe asset until you pick a stock).
 */
export interface Steer {
  skip: (symbol: string) => boolean;
  emptySlots: number;
}

export const NO_STEER: Steer = { skip: () => false, emptySlots: 0 };

/**
 * Leaves `n` slots empty: the lowest-ranked picks it doesn't hold yet are
 * dropped and their share waits in the safe asset (or cash), so a stock you
 * sold isn't replaced until you choose one. What it holds keeps running.
 */
export function leaveSlotsEmpty(
  weights: Targets,
  ranking: string[],
  held: (symbol: string) => boolean,
  n: number,
  safe: string | undefined,
): Targets {
  if (!(n > 0)) return weights;
  const rank = (s: string) => {
    const i = ranking.indexOf(s);
    return i < 0 ? Infinity : i;
  };
  const dropped = [...weights.keys()]
    .filter((s) => s !== safe && !held(s) && (weights.get(s)?.weight ?? 0) > 0)
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, n);
  if (!dropped.length) return weights;
  const out: Targets = new Map(weights);
  let moved = 0;
  for (const s of dropped) {
    moved += out.get(s)?.weight ?? 0;
    out.delete(s);
  }
  if (safe) {
    const prev = out.get(safe);
    out.set(safe, {
      weight: (prev?.weight ?? 0) + moved,
      why:
        prev?.why ??
        'a slot you left empty (you sold a stock): waits in T-bills until you pick one',
    });
  }
  return out;
}
