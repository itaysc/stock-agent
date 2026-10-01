import { listStrategies } from '../../strategies/strategy-registry.js';
import { SORT_KEYS } from '../sweep/sweep-report.js';
import {
  MAX_MIN_TRADES,
  MAX_PLAN_SETTINGS,
  type PlanKind,
  TEST_CHOICES,
  type TestPlan,
  TRAIN_CHOICES,
} from './test-plan.js';

const range = (min: number, max?: number) =>
  max === undefined ? `>= ${min}` : `${min}..${max}`;

/** The closed set of tests the AI may propose, as prompt text. */
export function describePlanMenu(kinds: readonly PlanKind[]): string {
  const strategies = listStrategies().map((s) => {
    const params = s.params.map(
      (p) =>
        `    ${p.name}: default ${p.default ?? '1 / number of symbols'}, ${p.integer ? 'whole number ' : ''}${range(p.min, p.max)}${p.lessThan ? `, must be < ${p.lessThan}` : ''}. ${p.description.split('. ')[0]}`,
    );
    return [`  - ${s.name}: ${s.description}`, ...params].join('\n');
  });
  return [
    'TEST MENU (only these values are accepted):',
    `kind: ${kinds.join(' | ')}${kinds.includes('walkforward') ? ' (walkforward = pick the best setting on training data, trade it on the next unseen period; the honest test)' : ''}`,
    'strategies (one or more) and their params:',
    ...strategies,
    'params: values to try per param, as a string: "10", "5,10,20" or "5..30:5". Omit a param to keep its default.',
    `At most ${MAX_PLAN_SETTINGS} settings per test (product of the value counts, per strategy).`,
    ...(kinds.includes('walkforward')
      ? [
          `train (walkforward): ${TRAIN_CHOICES.join(' | ')}`,
          `test (walkforward): ${TEST_CHOICES.join(' | ')}`,
          'anchored (walkforward): true = training grows from the start, false = fixed window that slides',
        ]
      : []),
    `sort (how the best setting is picked): ${SORT_KEYS.join(' | ')}`,
    `minTrades: 0..${MAX_MIN_TRADES} (settings with fewer closed trades can't be picked)`,
    'why: one short sentence, what the test checks',
  ].join('\n');
}

/** Symbols, period and costs a plan runs with (those of the run it came from). */
export interface PlanContext {
  symbols: string[];
  /** YYYY-MM-DD */
  from: string;
  to: string;
  timeframe: string;
  initialCash: number;
  slippageBps: number;
  feePerShare: number;
  cashYieldPct: number;
  newsGateTone?: number;
}

/** The context of a run request (next tests keep its symbols, period and costs). */
export function planContextOf(request: {
  symbols: string[];
  from: Date;
  to: Date;
  timeframe: string;
  initialCash: number;
  slippageBps: number;
  feePerShare: number;
  cashYieldPct?: number;
  newsGateTone?: number;
}): PlanContext {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  return {
    symbols: request.symbols.map((s) => s.trim().toUpperCase()),
    from: day(request.from),
    to: day(request.to),
    timeframe: request.timeframe,
    initialCash: request.initialCash,
    slippageBps: request.slippageBps,
    feePerShare: request.feePerShare,
    cashYieldPct: request.cashYieldPct ?? 0,
    newsGateTone: request.newsGateTone ?? 0,
  };
}

/** The npm command that runs a plan, e.g. for the terminal and the reports. */
export function planCommand(plan: TestPlan, ctx: PlanContext): string {
  const parts = [
    `npm run ${plan.kind} --`,
    ...ctx.symbols,
    `--strategy ${plan.strategies.join(',')}`,
    ...Object.entries(plan.params).map(([k, v]) => `--param ${k}=${v}`),
  ];
  if (plan.kind === 'walkforward') {
    parts.push(`--train ${plan.train} --test ${plan.test}`);
    if (plan.anchored) parts.push('--anchored');
  }
  parts.push(`--sort ${plan.sort}`);
  if (plan.minTrades) parts.push(`--min-trades ${plan.minTrades}`);
  parts.push(`--from ${ctx.from} --to ${ctx.to}`);
  if (ctx.timeframe !== '1Day') parts.push(`--timeframe ${ctx.timeframe}`);
  if (ctx.initialCash !== 100_000) parts.push(`--cash ${ctx.initialCash}`);
  if (ctx.slippageBps !== 5) parts.push(`--slippage ${ctx.slippageBps}`);
  if (ctx.feePerShare !== 0) parts.push(`--fee ${ctx.feePerShare}`);
  if ((ctx.cashYieldPct ?? 3) !== 3)
    parts.push(`--cash-yield ${ctx.cashYieldPct}`);
  if (ctx.newsGateTone) parts.push(`--news-gate ${ctx.newsGateTone}`);
  return parts.join(' ');
}

/** Short one-line description, e.g. "rules trendSma=100,200 trailingStop=8 · walk-forward 12m/3m · by return-dd". */
export function planLabel(plan: TestPlan): string {
  const params = Object.entries(plan.params)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  const how =
    plan.kind === 'walkforward'
      ? `walk-forward ${plan.train}/${plan.test}${plan.anchored ? ' anchored' : ''}`
      : 'sweep';
  const extra = plan.minTrades ? `, min ${plan.minTrades} trades` : '';
  return `${plan.strategies.join('+')}${params ? ` ${params}` : ''} · ${how} · by ${plan.sort}${extra}`;
}
