import type { ParamInfo, StrategyInfo } from '../api/types';
import { expandValues } from './paramGrid';

/** Mirrors the server's checks so invalid settings can't be submitted. */
export function checkValue(param: ParamInfo, value: number): string | undefined {
  if (param.integer && !Number.isInteger(value)) return 'Whole numbers only';
  if (value < param.min || (param.max !== undefined && value > param.max)) {
    return param.max === undefined
      ? `At least ${param.min}`
      : `Between ${param.min} and ${param.max}`;
  }
  return undefined;
}

/** Errors per param for a backtest (blank fields use the defaults). */
export function backtestErrors(
  strategy: StrategyInfo | undefined,
  values: Record<string, string> = {},
  symbolCount: number,
): Record<string, string> {
  if (!strategy) return {};
  const resolved = Object.fromEntries(
    strategy.params.map((p) => {
      const raw = values[p.name]?.trim();
      return [p.name, raw ? Number(raw) : (p.default ?? 1 / Math.max(symbolCount, 1))];
    }),
  );
  const errors: Record<string, string> = {};
  for (const p of strategy.params) {
    const error = checkValue(p, resolved[p.name]);
    if (error) errors[p.name] = error;
    else if (p.lessThan && !(resolved[p.name] < resolved[p.lessThan])) {
      // Flag the field the user actually changed.
      const field = values[p.name]?.trim() ? p.name : p.lessThan;
      errors[field] = `${p.name} must be less than ${p.lessThan} (${resolved[p.lessThan]})`;
    }
  }
  return errors;
}

/** Errors per param for a sweep: every listed value must be valid on its own. */
export function sweepErrors(
  strategy: StrategyInfo | undefined,
  specs: Record<string, string> = {},
): Record<string, string> {
  if (!strategy) return {};
  const errors: Record<string, string> = {};
  for (const p of strategy.params) {
    const { values, error } = expandValues(specs[p.name] ?? '');
    const bad = values.map((v) => checkValue(p, v)).find(Boolean);
    if (error || bad) errors[p.name] = error ?? `${bad} (every value)`;
  }
  return errors;
}
