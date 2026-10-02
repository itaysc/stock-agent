import { curveStats, mixedCurve, type Curve } from './profile-stats.js';

export type { Curve } from './profile-stats.js';

/** A mix of strategies (re-balanced yearly): its total, yearly return and worst drop. */
export function mixCurves(parts: Array<{ curve: Curve[]; weight: number }>) {
  const s = curveStats(mixedCurve(parts));
  return {
    returnPct: s.totalPct,
    annualPct: s.annualPct,
    maxDrawdownPct: s.maxDrawdownPct,
  };
}
