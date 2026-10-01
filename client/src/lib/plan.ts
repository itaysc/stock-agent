import type { PlanContext, TestPlan } from '../api/research-types';
import type { BacktestOptions } from '../api/types';
import type { FormValues } from './form';

/**
 * The form set up to run an AI-suggested test: its strategies, param values,
 * windows and ranking, with the symbols, period and costs of the run it came from.
 */
export function formFromPlan(
  values: FormValues,
  plan: TestPlan,
  ctx: PlanContext,
  options: BacktestOptions,
): FormValues {
  const specs = { ...values.specs };
  for (const name of plan.strategies) {
    const own = options.strategies.find((s) => s.name === name)?.params.map((p) => p.name) ?? [];
    specs[name] = Object.fromEntries(Object.entries(plan.params).filter(([k]) => own.includes(k)));
  }
  return {
    ...values,
    mode: plan.kind,
    strategies: plan.strategies,
    specs,
    symbols: ctx.symbols,
    period: [ctx.from, ctx.to],
    timeframe: ctx.timeframe,
    cash: ctx.initialCash,
    slippageBps: ctx.slippageBps,
    feePerShare: ctx.feePerShare,
    cashYieldPct: ctx.cashYieldPct ?? values.cashYieldPct,
    newsGateTone: ctx.newsGateTone ?? values.newsGateTone,
    minTrades: plan.minTrades,
    ...(plan.kind === 'walkforward'
      ? {
          train: plan.train ?? values.train,
          test: plan.test ?? values.test,
          anchored: plan.anchored ?? false,
          wfSort: plan.sort,
        }
      : { sort: plan.sort }),
  };
}

export const planParams = (plan: TestPlan) =>
  Object.entries(plan.params)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ') || 'defaults';
