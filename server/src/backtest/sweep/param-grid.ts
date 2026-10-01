import { strategyParamNames } from '../../strategies/strategy-registry.js';

/** Guards against accidentally launching a huge sweep. */
export const MAX_COMBINATIONS = 2_000;

export type ParamGrid = Record<string, string[]>;

/**
 * Parses one `--param` value:
 *   fast=10          → ['10']
 *   fast=5,10,20     → ['5', '10', '20']
 *   fast=5..30       → 5, 6, ..., 30
 *   fast=5..30:5     → 5, 10, ..., 30
 *   oversold=20..35:2.5 → decimals work too
 */
export function parseParamSpec(spec: string): [string, string[]] {
  const eq = spec.indexOf('=');
  if (eq <= 0) throw new Error(`Invalid param "${spec}" (expected key=value)`);
  const key = spec.slice(0, eq).trim();
  const value = spec.slice(eq + 1).trim();

  const range = /^(-?[\d.]+)\.\.(-?[\d.]+)(?::([\d.]+))?$/.exec(value);
  if (range) {
    const [start, end, step] = [range[1], range[2], range[3] ?? '1'].map(
      Number,
    );
    if (
      ![start, end, step].every(Number.isFinite) ||
      step <= 0 ||
      end < start
    ) {
      throw new Error(
        `Invalid range "${value}" for ${key} (start..end[:step])`,
      );
    }
    const values: string[] = [];
    // Count steps as integers to avoid float drift (e.g. 0.1 + 0.2).
    const count = Math.floor((end - start) / step + 1e-9);
    for (let i = 0; i <= count; i++) {
      values.push(String(Number((start + i * step).toFixed(10))));
    }
    return [key, values];
  }

  const values = value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (values.length === 0) throw new Error(`Param ${key} has no value`);
  return [key, values];
}

export function parseParamGrid(specs: string[]): ParamGrid {
  const grid: ParamGrid = {};
  for (const spec of specs) {
    const [key, values] = parseParamSpec(spec);
    grid[key] = values;
  }
  return grid;
}

/** Every combination of the grid's values (cartesian product). */
export function expandGrid(grid: ParamGrid): Record<string, string>[] {
  const total = Object.values(grid).reduce((n, v) => n * v.length, 1);
  if (total > MAX_COMBINATIONS) {
    throw new Error(
      `Sweep has ${total} combinations (max ${MAX_COMBINATIONS}): use fewer values or larger steps`,
    );
  }
  return Object.entries(grid).reduce<Record<string, string>[]>(
    (combos, [key, values]) =>
      combos.flatMap((combo) => values.map((v) => ({ ...combo, [key]: v }))),
    [{}],
  );
}

/**
 * Combos per strategy, each using only the grid params that strategy has.
 * Throws for unknown strategies and for params no selected strategy has.
 */
export function planCombos(
  strategies: string[],
  grid: ParamGrid,
): Array<{ strategy: string; combos: Record<string, string>[] }> {
  if (strategies.length === 0)
    throw new Error('At least one strategy is required');
  const known = new Set<string>();
  const plans = strategies.map((strategy) => {
    const names = strategyParamNames(strategy); // throws for unknown strategies
    names.forEach((n) => known.add(n));
    const ownGrid = Object.fromEntries(
      Object.entries(grid).filter(([key]) => names.includes(key)),
    );
    return { strategy, combos: expandGrid(ownGrid) };
  });
  const unknown = Object.keys(grid).filter((key) => !known.has(key));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown param ${unknown.join(', ')} for ${strategies.join(', ')}`,
    );
  }
  return plans;
}
