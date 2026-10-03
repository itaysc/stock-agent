import { sectors } from './rotation-sectors.js';
import { volScale, type VolTracker } from '../sizing.js';
import { basketVolPct, mixedReturn, steadiness } from './rotation-signals.js';

type Params = Record<string, number>;
const pct = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;

export interface RotationState {
  p: Params;
  symbols: string[];
  closes: Map<string, number[]>;
  vols: Map<string, VolTracker>;
  /** SPY below its marketFilter average: hold nothing risky. */
  marketDown: boolean;
  /** Above its own trendSma average (the per-stock trend filter). */
  aboveTrend: (symbol: string) => boolean;
  /** Held now (recentDrop only blocks new buys unless recentDropHeld). */
  held?: (symbol: string) => boolean;
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

/** The symbols to rank (all but the safe asset), best first, with their scores. */
export function rankSymbols({
  p,
  symbols,
  closes,
  vols,
}: Pick<RotationState, 'p' | 'symbols' | 'closes' | 'vols'>) {
  const safe = p.safeLast ? symbols.at(-1) : undefined;
  const score = (s: string) => {
    const c = closes.get(s) ?? [];
    const end = c.length - 1 - p.skipRecent;
    return c[end] / c[end - p.lookback] - 1;
  };
  const volOf = (s: string) => Math.max(vols.get(s)?.volPct ?? 1, 1);
  const mixed = (s: string) => {
    const c = closes.get(s) ?? [];
    return mixedReturn(c, c.length - 1 - p.skipRecent, p.lookback);
  };
  // 0 momentum, 1 risk-adjusted momentum, 2 lowest volatility, 3 biggest dip (mean reversion),
  // 4 momentum averaged over 3, 6 and 12 months.
  const rank = (s: string) =>
    [
      score,
      (x: string) => score(x) / volOf(x),
      (x: string) => -volOf(x),
      (x: string) => -score(x),
      mixed,
    ][p.rankBy]?.(s) ?? score(s);
  const ranked = symbols
    .filter((s) => s !== safe)
    .sort((a, b) => rank(b) - rank(a));
  return { ranked, score, volOf };
}

/** With keepRank: the stocks it holds come first while they still rank in the top `keepRank` (fewer trades). */
function keepHeld(
  p: Params,
  ranked: string[],
  candidates: string[],
  held?: (symbol: string) => boolean,
) {
  if (!(p.keepRank > 0) || !held) return candidates;
  const keep = (s: string) => held(s) && ranked.indexOf(s) < p.keepRank;
  return [...candidates.filter(keep), ...candidates.filter((s) => !keep(s))];
}

/** With steadyPool: of the best `steadyPool`, the steadiest risers first (then the rest, in rank order). */
function steadyFirst(
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

/**
 * The rotation's target share of the account per symbol, with the reason:
 * rank (momentum, risk-adjusted, calmest or biggest dip), keep the top N that
 * pass the filters, weigh them, and give empty slots to the safe asset.
 */
export function rotationTargets({
  p,
  symbols,
  closes,
  vols,
  marketDown,
  aboveTrend,
  held,
}: RotationState): Map<string, { weight: number; why: string }> {
  const safe = p.safeLast ? symbols.at(-1) : undefined;
  const { ranked, score, volOf } = rankSymbols({ p, symbols, closes, vols });
  const picks = marketDown
    ? []
    : capBySector(
        keepHeld(
          p,
          ranked,
          steadyFirst(
            p,
            closes,
            ranked.filter(
              (s) =>
                aboveTrend(s) &&
                ((!p.recentDropHeld && held?.(s)) || recentOk(p, closes, s)),
            ),
          ),
          held,
        ),
        p.topN,
        p.maxPerSector,
      ).filter((s) => !p.absMomentum || score(s) > 0);
  const vol = (s: string) => vols.get(s)?.volPct ?? null;
  const raw = picks.map((s) =>
    p.volWeight && vol(s) ? 1 / (vol(s) as number) : 1,
  );
  const rawSum = raw.reduce((a, b) => a + b, 0) || 1;
  // Each of the topN slots is 1/topN of the money; empty slots go to the safe asset or cash.
  const riskyShare = picks.length / p.topN;
  let w = picks.map((_, i) => (raw[i] / rawSum) * riskyShare);
  const avgVol =
    picks.reduce((n, s, i) => n + w[i] * (vol(s) ?? 0), 0) /
    (w.reduce((a, b) => a + b, 0) || 1);
  // basketVol: the picks together over the last 6 months (with how they move together); the rest goes to the safe asset.
  const basket = volScale(
    p.basketVol,
    p.basketVol > 0 ? basketVolPct(picks, w, closes, 126) : null,
  );
  const scale = Math.min(
    volScale(p.targetVol, picks.length ? avgVol : null),
    basket,
  );
  w = w.map((x) => x * scale * p.allocation);
  const out = new Map<string, { weight: number; why: string }>();
  picks.forEach((s, i) =>
    out.set(s, {
      weight: w[i],
      why:
        p.rankBy === 2
          ? `rank ${ranked.indexOf(s) + 1}: one of the calmest (${volOf(s).toFixed(0)}% yearly volatility)`
          : `rank ${ranked.indexOf(s) + 1}: ${pct(score(s))} over ${p.lookback} bars${scale < 1 ? `, sized to ${basket < 1 ? p.basketVol : p.targetVol}% volatility` : ''}`,
    }),
  );
  if (safe && (picks.length < p.topN || basket < 1)) {
    out.set(safe, {
      weight: (1 - riskyShare * basket) * p.allocation,
      why: marketDown
        ? `market down: SPY below its ${p.marketFilter}-day average`
        : picks.length < p.topN
          ? `safe asset for ${p.topN - picks.length} empty slot${p.topN - picks.length === 1 ? '' : 's'}`
          : `safe asset: the stocks swing more than ${p.basketVol}% a year, so they are held smaller`,
    });
  }
  return out;
}
