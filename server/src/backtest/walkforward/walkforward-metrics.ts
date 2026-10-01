import type { WindowResult } from './walkforward.types.js';

const YEAR_MS = 365.25 * 86_400_000;

/** Compound annual return, in percent, of a total return over a period. */
export function annualizedPct(
  totalReturnPct: number,
  from: Date,
  to: Date,
): number | null {
  const years = (to.getTime() - from.getTime()) / YEAR_MS;
  if (years <= 0) return null;
  return ((1 + totalReturnPct / 100) ** (1 / years) - 1) * 100;
}

/** Average annualized return of the settings picked on each training period. */
export function inSampleAnnualPct(windows: WindowResult[]): number | null {
  const values = windows
    .filter((w) => w.chosen)
    .map((w) =>
      annualizedPct(w.chosen?.trainReturnPct ?? 0, w.trainFrom, w.trainTo),
    )
    .filter((v): v is number => v !== null);
  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
}

/**
 * Walk-forward efficiency: out-of-sample vs in-sample annual return. Around
 * 50%+ suggests the tuning captures something real; near 0 (or negative)
 * suggests it mostly fit noise in the training data.
 */
export function efficiencyPct(
  inSample: number | null,
  outOfSample: number | null,
): number | null {
  if (inSample === null || outOfSample === null || inSample <= 0) return null;
  return (outOfSample / inSample) * 100;
}

/** How often the chosen setting changed between windows, and how many distinct ones were used. */
export function paramStability(windows: WindowResult[]) {
  const keys = windows
    .filter((w) => w.chosen)
    .map((w) => `${w.chosen?.strategy} ${JSON.stringify(w.chosen?.params)}`);
  const changes = keys.filter((k, i) => i > 0 && k !== keys[i - 1]).length;
  return { paramChanges: changes, distinctSettings: new Set(keys).size };
}
