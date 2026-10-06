export type Targets = Map<string, { weight: number; why: string }>;

/** Lookback windows mixed by lookbackMix: about 6, 9 and 12 months. */
export const MIXED_LOOKBACKS = [126, 189, 252];

/** The average of several target maps (a symbol missing from one counts 0 there). */
export function averageTargets(maps: Targets[]): Targets {
  const out: Targets = new Map();
  for (const m of maps)
    for (const [s, t] of m) {
      const prev = out.get(s);
      out.set(s, {
        weight: (prev?.weight ?? 0) + t.weight / maps.length,
        why: prev?.why ?? t.why,
      });
    }
  return out;
}

/**
 * The portfolio as n tranches, one re-ranked each day: it holds the average
 * of the last n days' targets, so no single re-rank day decides everything
 * (less "timing luck"). Starts with what it has (one day = all of it).
 */
export class Tranches {
  private readonly days: Targets[] = [];

  constructor(private readonly n: number) {}

  /** Today's targets in; the average of the last n days out (today's reasons first). */
  push(today: Targets): Targets {
    this.days.push(today);
    if (this.days.length > this.n) this.days.shift();
    return averageTargets([...this.days].reverse());
  }

  clear(): void {
    this.days.length = 0;
  }
}
