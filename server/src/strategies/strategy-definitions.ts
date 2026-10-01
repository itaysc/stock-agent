import { RsiReversionStrategy } from './rsi-reversion.strategy.js';
import { MomentumRotationStrategy } from './rotation/momentum-rotation.strategy.js';
import {
  ROTATION_ALLOCATION,
  ROTATION_PARAMS,
} from './rotation/rotation-params.js';
import { RULES_PARAMS } from './rules/rules-params.js';
import { validateRules } from './rules/rules-validate.js';
import { RulesStrategy } from './rules/rules.strategy.js';
import { SmaCrossoverStrategy } from './sma-crossover.strategy.js';
import type { ParamSpec, ParamSpecs } from './strategy-params.js';
import type { Strategy } from './strategy.types.js';

type Resolved = Record<string, number>;

export interface StrategyDefinition {
  /**
   * Bump whenever the strategy's logic changes (entries, exits, sizing), so
   * saved backtests of the old logic count as stale and are re-run.
   */
  version: number;
  description: string;
  /** Params with defaults, limits and explanations (allocation is added to every strategy). */
  params: ParamSpecs;
  /** Replaces the usual allocation param (e.g. rotation: share of the account kept invested). */
  allocation?: ParamSpec;
  /** Checks across params that the per-param specs can't express. */
  validate?: (params: Resolved) => void;
  create: (symbols: string[], params: Resolved) => Strategy;
}

/** Strategies by name. Add new strategies here. */
export const STRATEGIES: Record<string, StrategyDefinition> = {
  'sma-crossover': {
    version: 1,
    description: 'trend: buy when the fast SMA crosses above the slow SMA',
    params: {
      fast: {
        default: 20,
        min: 1,
        integer: true,
        lessThan: 'slow',
        description:
          'Length of the fast moving average, in bars. Reacts quickly to price changes.',
      },
      slow: {
        default: 50,
        min: 2,
        integer: true,
        description:
          'Length of the slow moving average, in bars. Must be longer than fast.',
      },
    },
    create: (symbols, p) =>
      new SmaCrossoverStrategy({
        symbols,
        fast: p.fast,
        slow: p.slow,
        allocation: p.allocation,
      }),
  },
  'rsi-reversion': {
    version: 1,
    description: 'mean reversion: buy oversold dips in an uptrend',
    params: {
      period: {
        default: 14,
        min: 2,
        integer: true,
        description:
          'RSI length, in bars. Shorter reacts faster but is noisier.',
      },
      oversold: {
        default: 30,
        min: 1,
        max: 99,
        lessThan: 'overbought',
        description:
          'Buy when RSI falls below this level (the stock is "oversold").',
      },
      overbought: {
        default: 70,
        min: 1,
        max: 99,
        description:
          'Sell when RSI rises above this level (the stock has bounced).',
      },
      trend: {
        default: 200,
        min: 0,
        integer: true,
        description:
          'Only buy while the price is above its moving average of this many bars (an uptrend). 0 turns the filter off.',
      },
    },
    create: (symbols, p) =>
      new RsiReversionStrategy({
        symbols,
        period: p.period,
        oversold: p.oversold,
        overbought: p.overbought,
        trend: p.trend,
        allocation: p.allocation,
      }),
  },
  rules: {
    version: 2, // v2: MACD, volume, market filter and ATR-stop blocks; indicators from trading-signals
    description:
      'building blocks: combine entry rules (trend, crossover, RSI, breakout, dip, Bollinger, MACD, volume, market trend and calm, news tone, earnings) with exit rules (stops, ATR stop, targets, trend, RSI, MACD, market, volatility, bad news, earnings, max hold)',
    params: RULES_PARAMS,
    validate: validateRules,
    create: (symbols, p) => new RulesStrategy(symbols, p),
  },
  'momentum-rotation': {
    version: 1,
    description:
      'rotation: hold the top N symbols by recent return, re-ranked every month; falling ones make way for a safe asset or cash',
    params: ROTATION_PARAMS,
    allocation: ROTATION_ALLOCATION,
    create: (symbols, p) => new MomentumRotationStrategy(symbols, p),
  },
};
