import { sectors } from './rotation-sectors.js';
import { steadiness } from './rotation-signals.js';
import type { Params } from './rotation-targets.js';

/**
 * crowdFilter: of the best 3×topN by rank, skips the most crowded third,
 * the most traded ("late-stage" winners that reverse sooner): 1 by volume
 * against the stock's own past year, 2 by turnover (lab: SEC market value).
 * Stocks it holds stay.
 */
export function dropCrowded(
  p: Params,
  ranked: string[],
  crowding: (s: string) => number | null | undefined,
  held?: (symbol: string) => boolean,
): string[] {
  if (!(p.crowdFilter > 0)) return ranked;
  const known = ranked
    .slice(0, 3 * p.topN)
    .map((s) => ({ s, v: crowding(s) }))
    .filter((x): x is { s: string; v: number } => Number.isFinite(x.v))
    .sort((a, b) => b.v - a.v);
  const crowded = new Set(
    known.slice(0, Math.floor(known.length / 3)).map((x) => x.s),
  );
  return ranked.filter((s) => !crowded.has(s) || held?.(s));
}

/** Not down more than recentDrop % over the last month (always true with it off). */
export function recentOk(
  p: Params,
  closes: Map<string, number[]>,
  s: string,
): boolean {
  if (!(p.recentDrop > 0)) return true;
  const c = closes.get(s) ?? [];
  const then = c.at(-22);
  return !then || (c.at(-1) ?? then) / then - 1 > -p.recentDrop / 100;
}

/** The best `n`, with at most `max` from one sector (0 = no limit): a full sector's next ones are skipped. */
export function capBySector(
  ranked: string[],
  n: number,
  max: number,
): string[] {
  if (!(max > 0)) return ranked.slice(0, n);
  const count = new Map<string, number>();
  const out: string[] = [];
  for (const s of ranked) {
    if (out.length >= n) break;
    const sector = sectors.of(s);
    if ((count.get(sector) ?? 0) >= max) continue;
    count.set(sector, (count.get(sector) ?? 0) + 1);
    out.push(s);
  }
  return out;
}

/** With keepRank: the stocks it holds come first while they still rank in the top `keepRank` (fewer trades). */
export function keepHeld(
  p: Params,
  ranked: string[],
  candidates: string[],
  held?: (symbol: string) => boolean,
) {
  if (!(p.keepRank > 0) || !held) return candidates;
  const keep = (s: string) => held(s) && ranked.indexOf(s) < p.keepRank;
  return [...candidates.filter(keep), ...candidates.filter((s) => !keep(s))];
}

/** With sectorTop: only stocks from the `sectorTop` sectors whose stocks rose most on average (industry momentum). */
export function inTopSectors(
  p: Params,
  ranked: string[],
  score: (s: string) => number,
): (s: string) => boolean {
  if (!(p.sectorTop > 0)) return () => true;
  const by = new Map<string, number[]>();
  for (const s of ranked) {
    const sector = sectors.of(s);
    if (sector.startsWith('(')) continue; // unknown sector
    by.set(sector, [...(by.get(sector) ?? []), score(s)]);
  }
  const top = new Set(
    [...by]
      .map(([sector, xs]) => ({
        sector,
        avg: xs.reduce((a, b) => a + b, 0) / xs.length,
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, p.sectorTop)
      .map((x) => x.sector),
  );
  return (s) => top.has(sectors.of(s));
}

/** With steadyPool: of the best `steadyPool`, the steadiest risers first (then the rest, in rank order). */
export function steadyFirst(
  p: Params,
  closes: Map<string, number[]>,
  ranked: string[],
) {
  if (!(p.steadyPool > 0)) return ranked;
  const steady = (s: string) => {
    const c = closes.get(s) ?? [];
    return steadiness(c, c.length - 1 - p.skipRecent, p.lookback);
  };
  const pool = ranked.slice(0, p.steadyPool);
  return [
    ...pool.sort((a, b) => steady(b) - steady(a)),
    ...ranked.slice(p.steadyPool),
  ];
}
