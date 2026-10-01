import { volScale, type VolTracker } from '../sizing.js';

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
  // 0 momentum, 1 risk-adjusted momentum, 2 lowest volatility, 3 biggest dip (mean reversion).
  const rank = (s: string) =>
    [score(s), score(s) / volOf(s), -volOf(s), -score(s)][p.rankBy] ?? score(s);
  const ranked = symbols
    .filter((s) => s !== safe)
    .sort((a, b) => rank(b) - rank(a));
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
}: RotationState): Map<string, { weight: number; why: string }> {
  const safe = p.safeLast ? symbols.at(-1) : undefined;
  const { ranked, score, volOf } = rankSymbols({ p, symbols, closes, vols });
  const picks = marketDown
    ? []
    : ranked
        .filter((s) => aboveTrend(s))
        .slice(0, p.topN)
        .filter((s) => !p.absMomentum || score(s) > 0);
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
  const scale = volScale(p.targetVol, picks.length ? avgVol : null);
  w = w.map((x) => x * scale * p.allocation);
  const out = new Map<string, { weight: number; why: string }>();
  picks.forEach((s, i) =>
    out.set(s, {
      weight: w[i],
      why:
        p.rankBy === 2
          ? `rank ${ranked.indexOf(s) + 1}: one of the calmest (${volOf(s).toFixed(0)}% yearly volatility)`
          : `rank ${ranked.indexOf(s) + 1}: ${pct(score(s))} over ${p.lookback} bars${scale < 1 ? `, sized to ${p.targetVol}% volatility` : ''}`,
    }),
  );
  if (safe && picks.length < p.topN) {
    out.set(safe, {
      weight: (1 - riskyShare) * p.allocation,
      why: marketDown
        ? `market down: SPY below its ${p.marketFilter}-day average`
        : `safe asset for ${p.topN - picks.length} empty slot${p.topN - picks.length === 1 ? '' : 's'}`,
    });
  }
  return out;
}
