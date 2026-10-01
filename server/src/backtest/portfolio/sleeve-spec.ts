import type { Sleeve } from './portfolio.types.js';

/**
 * Parses a sleeve written as "WEIGHT STRATEGY SYMBOLS [param=value ...]",
 * e.g. "40 rules AAPL,MSFT breakout=20 atrStop=3" (the % sign is optional).
 */
export function parseSleeve(spec: string): Sleeve {
  const [weight, strategy, symbols, ...params] = spec.trim().split(/\s+/);
  const weightPct = Number(weight?.replace('%', ''));
  if (!Number.isFinite(weightPct) || !strategy || !symbols) {
    throw new Error(
      `Invalid sleeve "${spec}" (expected: WEIGHT STRATEGY SYMBOLS [param=value ...], e.g. "40 rules AAPL,MSFT breakout=20")`,
    );
  }
  return {
    weightPct,
    strategy,
    symbols: symbols.split(','),
    params: Object.fromEntries(
      params.map((p) => {
        const eq = p.indexOf('=');
        if (eq <= 0)
          throw new Error(
            `Invalid param "${p}" in sleeve "${spec}" (expected key=value)`,
          );
        return [p.slice(0, eq), p.slice(eq + 1)];
      }),
    ),
  };
}
