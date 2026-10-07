import { volScale, type VolTracker } from '../sizing.js';
import { blendScores, fundamentals } from './rotation-fundamentals.js';
import {
  capBySector,
  dropCrowded,
  inTopSectors,
  keepHeld,
  recentOk,
  steadyFirst,
} from './rotation-filters.js';
import { earningsDays } from './rotation-events.js';
import {
  volumeSurge,
  basketVolPct,
  mixedReturn,
  nearHigh,
  residualScore,
} from './rotation-signals.js';

export type Params = Record<string, number>;

export { capBySector, recentOk } from './rotation-filters.js';
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
  /** SPY closes ending on the same day (for rankBy 5, residual momentum). */
  market?: number[];
  /** The day it ranks on (for blend: the company reports public by then). */
  now?: Date;
  /** Daily volumes (crowdFilter 1). */
  volumes?: Map<string, number[]>;
}

/** The symbols to rank (all but the safe asset), best first, with their scores. */
export function rankSymbols({
  p,
  symbols,
  closes,
  vols,
  market = [],
  now,
}: Pick<
  RotationState,
  'p' | 'symbols' | 'closes' | 'vols' | 'market' | 'now'
>) {
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
  const residual = (s: string) => {
    const c = closes.get(s) ?? [];
    const r = residualScore(c, market, c.length - 1 - p.skipRecent, p.lookback);
    return Number.isNaN(r) ? -Infinity : r;
  };
  // 0 momentum, 1 risk-adjusted momentum, 2 lowest volatility, 3 biggest dip (mean reversion),
  // 4 momentum averaged over 3, 6 and 12 months, 5 residual momentum (beat the market's
  // part), 6 nearest its 52-week high.
  const rank = (s: string) =>
    [
      score,
      (x: string) => score(x) / volOf(x),
      (x: string) => -volOf(x),
      (x: string) => -score(x),
      mixed,
      residual,
      (x: string) => nearHigh(closes.get(x) ?? [], 252),
    ][p.rankBy]?.(s) ?? score(s);
  const ranked = symbols
    .filter((s) => s !== safe)
    .sort((a, b) => rank(b) - rank(a));
  // blend: mix the momentum rank with value / quality from the company reports (algo lab).
  if (p.blend > 0 && now) {
    const mixed = blendScores(ranked, now, rank, p.blend);
    ranked.sort((a, b) => (mixed.get(b) ?? 0) - (mixed.get(a) ?? 0));
  }
  return { ranked, score, volOf };
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
  market,
  now,
  volumes,
}: RotationState): Map<string, { weight: number; why: string }> {
  const safe = p.safeLast ? symbols.at(-1) : undefined;
  const { ranked, score, volOf } = rankSymbols({
    p,
    symbols,
    closes,
    vols,
    market,
    now,
  });
  const topSector = inTopSectors(p, ranked, score);
  const allowed = ranked.filter(
    (s) =>
      aboveTrend(s) &&
      topSector(s) &&
      // earningsWait: don't start a position days before its earnings (held ones stay).
      (!(p.earningsWait > 0) ||
        !now ||
        held?.(s) ||
        !earningsDays.within(s, now, p.earningsWait)) &&
      ((!p.recentDropHeld && held?.(s)) || recentOk(p, closes, s)),
  );
  const crowding = (s: string) =>
    p.crowdFilter === 2
      ? now && fundamentals.of(s, now)?.turnover
      : volumeSurge(volumes?.get(s) ?? []);
  const candidates = dropCrowded(
    p,
    steadyFirst(p, closes, allowed),
    crowding,
    held,
  );
  const picks = marketDown
    ? []
    : capBySector(
        keepHeld(p, ranked, candidates, held),
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
