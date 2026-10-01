import dayjs from 'dayjs';
import type { ResearchGoal } from '../api/research-types';
import type { BacktestOptions, SleeveInput, SortKey } from '../api/types';

export type Mode = 'backtest' | 'sweep' | 'walkforward' | 'research' | 'portfolio';

export interface FormValues {
  mode: Mode;
  symbols: string[];
  /** Backtest mode: one strategy. */
  strategy: string;
  /** Sweep / walk-forward: one or more strategies. */
  strategies: string[];
  /** Backtest values per strategy/param ('' = default). */
  params: Record<string, Record<string, string>>;
  /** Sweep / walk-forward specs per strategy/param ("5..30:5", '' = default). */
  specs: Record<string, Record<string, string>>;
  period: [string | null, string | null];
  timeframe: string;
  cash: number;
  slippageBps: number;
  feePerShare: number;
  /** Yearly interest on idle cash, in %. */
  cashYieldPct: number;
  /** Skip a buy when the news before its open averages this negative or worse (0 = off). */
  newsGateTone: number;
  sort: SortKey;
  minTrades: number;
  /** Walk-forward: training and test lengths ("12m", "3m"), and how the best setting is picked. */
  train: string;
  test: string;
  anchored: boolean;
  wfSort: SortKey;
  /** Research agent: hidden final stretch, what to optimize, and its budget. */
  holdout: string;
  goal: ResearchGoal;
  rounds: number;
  testsPerRound: number;
  /** Basket for the agent's multi-symbol check ('none' = skip). */
  basket: string;
  /** Portfolio: its sleeves, and the stop (sell everything at X% below the peak, 0 = off). */
  sleeves: SleeveInput[];
  maxDrawdownPct: number;
  cooldownDays: number;
  ai: boolean;
  fresh: boolean;
}

export const DATE = 'YYYY-MM-DD';

/** [from, to] covering the last `years` years (not before the data starts). */
export function lastYears(years: number, dataStart: string): [string, string] {
  const today = dayjs();
  const from = today.subtract(years, 'year').format(DATE);
  return [from < dataStart ? dataStart : from, today.format(DATE)];
}

export function defaultValues(options: BacktestOptions): FormValues {
  const first = options.strategies[0]?.name ?? 'sma-crossover';
  return {
    mode: 'backtest',
    symbols: ['AAPL', 'MSFT'],
    strategy: first,
    strategies: [first],
    params: {},
    specs: {},
    period: lastYears(options.defaults.years, options.dataStart),
    timeframe: options.defaults.timeframe,
    cash: options.defaults.cash,
    slippageBps: options.defaults.slippageBps,
    feePerShare: options.defaults.feePerShare,
    cashYieldPct: options.defaults.cashYieldPct,
    newsGateTone: 0,
    sort: 'return',
    minTrades: 0,
    train: options.defaults.walkForward.train,
    test: options.defaults.walkForward.test,
    anchored: false,
    wfSort: options.defaults.walkForward.sort,
    holdout: options.defaults.research.holdout,
    goal: options.defaults.research.goals[0] ?? 'risk-adjusted',
    rounds: options.defaults.research.rounds,
    testsPerRound: options.defaults.research.testsPerRound,
    basket: options.defaults.research.basket,
    sleeves: [
      { strategy: first, symbols: ['AAPL', 'MSFT'], params: {}, weightPct: 50 },
      {
        strategy: options.strategies[1]?.name ?? first,
        symbols: ['SPY'],
        params: {},
        weightPct: 30,
      },
    ],
    maxDrawdownPct: 15,
    cooldownDays: 20,
    ai: options.aiEnabled,
    fresh: false,
  };
}

/** Only the params that were filled in; the server applies defaults for the rest. */
export function filled(values: Record<string, string> | undefined) {
  return Object.fromEntries(Object.entries(values ?? {}).filter(([, v]) => v.trim() !== ''));
}

function common(v: FormValues) {
  return {
    symbols: v.symbols,
    timeframe: v.timeframe,
    from: v.period[0] ?? undefined,
    to: v.period[1] ?? undefined,
    cash: v.cash,
    slippageBps: v.slippageBps,
    feePerShare: v.feePerShare,
    cashYieldPct: v.cashYieldPct,
    newsGateTone: v.newsGateTone,
    ai: v.ai,
  };
}

export function backtestBody(v: FormValues) {
  return {
    ...common(v),
    strategy: v.strategy,
    params: filled(v.params[v.strategy]),
    fresh: v.fresh,
  };
}

/** Sweep params are shared by name across strategies (the server applies each where it exists). */
const specParams = (v: FormValues) =>
  Object.assign({}, ...v.strategies.map((s) => filled(v.specs[s])));

export function sweepBody(v: FormValues) {
  return {
    ...common(v),
    strategies: v.strategies,
    params: specParams(v),
    sort: v.sort,
    minTrades: v.minTrades,
  };
}

export function walkForwardBody(v: FormValues) {
  return {
    ...common(v),
    strategies: v.strategies,
    params: specParams(v),
    train: v.train.trim(),
    test: v.test.trim(),
    anchored: v.anchored,
    sort: v.wfSort,
    minTrades: v.minTrades,
  };
}

export function researchBody(v: FormValues) {
  return {
    ...common(v),
    strategies: v.strategies,
    goal: v.goal,
    holdout: v.holdout.trim(),
    rounds: v.rounds,
    testsPerRound: v.testsPerRound,
    basket: v.basket,
  };
}

/** The walk-forward setup of the form, checked on each symbol of `symbols` on its own. */
export function robustnessBody(v: FormValues, symbols: string[]) {
  return { ...walkForwardBody(v), symbols, goal: v.goal };
}

export function portfolioBody(v: FormValues) {
  const { symbols: _unused, ...shared } = common(v);
  return {
    ...shared,
    sleeves: v.sleeves.map((s) => ({ ...s, params: filled(s.params) })),
    maxDrawdownPct: v.maxDrawdownPct,
    cooldownDays: v.cooldownDays,
  };
}
