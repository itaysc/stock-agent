import { STRATEGIES, type StrategyDefinition } from './strategy-definitions.js';
import {
  ALLOCATION,
  type ParamSpec,
  type ParamSpecs,
  validateParams,
} from './strategy-params.js';
import type { Strategy } from './strategy.types.js';

export type StrategyParams = Record<string, string>;
type Resolved = Record<string, number>;

export const strategyNames = (): string[] => Object.keys(STRATEGIES);

function definition(name: string): StrategyDefinition {
  const def = STRATEGIES[name];
  if (!def) {
    throw new Error(
      `Unknown strategy "${name}". Available: ${strategyNames().join(', ')}`,
    );
  }
  return def;
}

/** A strategy's params, allocation included. */
function paramSpecs(name: string): ParamSpecs {
  const def = definition(name);
  return { ...def.params, allocation: def.allocation ?? ALLOCATION };
}

/** Tunable param names of a strategy (including allocation). */
export function strategyParamNames(name: string): string[] {
  return Object.keys(paramSpecs(name));
}

/** One line per strategy with its params and defaults, for CLI help. */
export function describeStrategies(): string {
  return strategyNames()
    .map((name) => {
      const { description, params: specs } = definition(name);
      const params = Object.entries(specs)
        .map(([k, spec]) => `${k}=${spec.default}`)
        .join(' ');
      return `    ${name.padEnd(15)} ${description}\n    ${''.padEnd(15)} params: ${params}`;
    })
    .join('\n');
}

export interface StrategyInfo {
  name: string;
  description: string;
  version: number;
  params: Array<ParamSpec & { name: string }>;
}

/** Strategies with their params and defaults (allocation defaults to 1 / symbols). */
export function listStrategies(): StrategyInfo[] {
  return strategyNames().map((name) => {
    const def = definition(name);
    return {
      name,
      description: def.description,
      version: def.version,
      params: Object.entries(paramSpecs(name)).map(([p, spec]) => ({
        name: p,
        ...spec,
      })),
    };
  });
}

export function strategyVersion(name: string): number {
  return definition(name).version;
}

/** Every param of the strategy with its value: given params over the defaults. */
export function resolveStrategyParams(
  name: string,
  symbols: string[],
  params: StrategyParams = {},
): Resolved {
  const specs = paramSpecs(name);
  if (symbols.length === 0) throw new Error('At least one symbol is required');

  const resolved: Resolved = Object.fromEntries(
    Object.entries(specs).map(([p, spec]) => [
      p,
      spec.default ?? 1 / symbols.length,
    ]),
  );
  for (const [key, raw] of Object.entries(params)) {
    if (!(key in resolved)) continue; // not a param of this strategy
    const value = Number(raw);
    if (!Number.isFinite(value))
      throw new Error(`Param ${key} must be a number`);
    resolved[key] = value;
  }
  validateParams(specs, resolved);
  definition(name).validate?.(resolved);
  return resolved;
}

export function createStrategy(
  name: string,
  symbols: string[],
  params: StrategyParams = {},
): Strategy {
  const resolved = resolveStrategyParams(name, symbols, params);
  return definition(name).create(symbols, resolved);
}
