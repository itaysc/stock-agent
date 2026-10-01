import {
  resolveStrategyParams,
  strategyNames,
} from '../../strategies/strategy-registry.js';
import {
  type ParamGrid,
  parseParamSpec,
  planCombos,
} from '../sweep/param-grid.js';
import { SORT_KEYS, type SortKey } from '../sweep/sweep-report.js';

export const PLAN_KINDS = ['walkforward', 'sweep'] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];
export const TRAIN_CHOICES = ['6m', '12m', '18m', '24m'] as const;
export const TEST_CHOICES = ['1m', '2m', '3m', '6m'] as const;
/** Keeps AI-proposed tests small: settings per test, summed over strategies. */
export const MAX_PLAN_SETTINGS = 60;
export const MAX_MIN_TRADES = 20;

/**
 * A follow-up test the AI may propose. Only these fields and only values from
 * the menu (see describePlanMenu): symbols, period, timeframe and costs always
 * stay those of the run it came from.
 */
export interface TestPlan {
  kind: PlanKind;
  strategies: string[];
  /** Values to try per param, sweep syntax ("10", "5,10,20", "5..30:5"); omitted = default. */
  params: Record<string, string>;
  /** Walk-forward only. */
  train?: string;
  test?: string;
  anchored?: boolean;
  sort: SortKey;
  minTrades: number;
  /** One sentence: what the test checks. */
  why: string;
}

export type PlanCheck =
  { plan: TestPlan; settings: number } | { error: string };

const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (list as readonly string[]).includes(v);

export const planGrid = (plan: Pick<TestPlan, 'params'>): ParamGrid =>
  Object.fromEntries(
    Object.entries(plan.params).map(([k, v]) => parseParamSpec(`${k}=${v}`)),
  );

/**
 * Validates an AI-proposed test against the menu. Returns the cleaned plan
 * and how many valid settings it has, or a readable error (fed back to the AI).
 */
export function checkPlan(
  raw: unknown,
  symbols: string[],
  kinds: readonly PlanKind[] = PLAN_KINDS,
): PlanCheck {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  if (!oneOf(kinds, r.kind))
    return { error: `kind must be ${kinds.join(' or ')}` };
  const strategies = [
    ...new Set(Array.isArray(r.strategies) ? r.strategies.map(String) : []),
  ];
  if (strategies.length === 0) return { error: 'strategies is empty' };
  const unknown = strategies.find((s) => !strategyNames().includes(s));
  if (unknown) {
    return {
      error: `unknown strategy "${unknown}" (allowed: ${strategyNames().join(', ')})`,
    };
  }
  const params = Object.fromEntries(
    Object.entries(
      r.params && typeof r.params === 'object' ? r.params : {},
    ).map(([k, v]) => [k, String(v).trim()]),
  );

  let settings = 0;
  let total = 0;
  let firstError = '';
  try {
    for (const { strategy, combos } of planCombos(
      strategies,
      planGrid({ params }),
    )) {
      total += combos.length;
      for (const combo of combos) {
        try {
          resolveStrategyParams(strategy, symbols, combo);
          settings++;
        } catch (err) {
          firstError ||= `${strategy}: ${(err as Error).message}`;
        }
      }
    }
  } catch (err) {
    return { error: (err as Error).message };
  }
  if (total > MAX_PLAN_SETTINGS) {
    return {
      error: `${total} settings (max ${MAX_PLAN_SETTINGS}): use fewer values`,
    };
  }
  if (settings === 0) return { error: `no valid setting (${firstError})` };

  const plan: TestPlan = {
    kind: r.kind,
    strategies,
    params,
    sort: oneOf(SORT_KEYS, r.sort) ? r.sort : 'return-dd',
    minTrades: Math.min(
      MAX_MIN_TRADES,
      Math.max(0, Math.round(Number(r.minTrades) || 0)),
    ),
    why: typeof r.why === 'string' ? r.why.trim().slice(0, 240) : '',
  };
  if (plan.kind === 'walkforward') {
    if (!oneOf(TRAIN_CHOICES, r.train)) {
      return { error: `train must be one of ${TRAIN_CHOICES.join(', ')}` };
    }
    if (!oneOf(TEST_CHOICES, r.test)) {
      return { error: `test must be one of ${TEST_CHOICES.join(', ')}` };
    }
    Object.assign(plan, {
      train: r.train,
      test: r.test,
      anchored: r.anchored === true,
    });
  }
  return { plan, settings };
}

/** Stable key of a plan, to spot the same test proposed twice. */
export function planKey(plan: TestPlan): string {
  const params = Object.keys(plan.params)
    .sort()
    .map((k) => `${k}=${plan.params[k]}`);
  return JSON.stringify([
    plan.kind,
    [...plan.strategies].sort(),
    params,
    plan.train ?? null,
    plan.test ?? null,
    plan.anchored ?? false,
    plan.sort,
    plan.minTrades,
  ]);
}
