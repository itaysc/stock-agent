import type { ParamSpec, ParamSpecs } from '../strategy-params.js';
import {
  INFO_ENTRY_RULES,
  INFO_EXIT_RULES,
  INFO_PARAMS,
} from './rules-params-info.js';

const bars = (
  description: string,
  extra: Partial<ParamSpec> = {},
): ParamSpec => ({
  default: 0,
  min: 0,
  integer: true,
  zeroIsOff: true,
  description: `${description} 0 = off.`,
  ...extra,
});
const percent = (description: string, max: number, dflt = 0): ParamSpec => ({
  default: dflt,
  min: 0,
  max,
  zeroIsOff: true,
  description: `${description} 0 = off.`,
});

/** Entry rules: every rule that is on must hold on the same bar to buy. */
export const ENTRY_RULES = [
  'trendSma',
  'crossSlow',
  'rsiBelow',
  'breakout',
  'dipPct',
  'bbPeriod',
  'macdCross',
  'volumeRatio',
  'marketSma',
  ...INFO_ENTRY_RULES,
];
/** Exit rules: any rule that is on sells the whole position. */
export const EXIT_RULES = [
  'crossExit',
  'exitTrendSma',
  'rsiAbove',
  'breakdown',
  'stopLoss',
  'takeProfit',
  'trailingStop',
  'maxHold',
  'macdExit',
  'atrStop',
  'marketExit',
  ...INFO_EXIT_RULES,
];

/**
 * Building blocks of the `rules` strategy. Every param is a number so rules
 * can be swept and tuned like any other param. Default: buy a 20-bar breakout,
 * exit on a 10% trailing stop.
 */
export const RULES_PARAMS: ParamSpecs = {
  trendSma: bars(
    'Entry filter: only buy while the close is above its moving average of this many bars (an uptrend).',
  ),
  crossFast: bars(
    'Entry signal (with crossSlow): the moving average of this many bars crosses above the crossSlow one.',
  ),
  crossSlow: bars(
    'Entry signal: length of the slow moving average for the crossover. Must be longer than crossFast.',
  ),
  rsiPeriod: {
    default: 14,
    min: 2,
    integer: true,
    description: 'RSI length, in bars, for rsiBelow and rsiAbove.',
  },
  rsiBelow: percent('Entry: RSI is below this level (oversold).', 99),
  breakout: bars(
    'Entry signal: the close is above the highest high of the previous this-many bars.',
    { default: 20 },
  ),
  dipPct: percent(
    'Entry: the close is at least this % under the highest close of the last dipLookback bars.',
    50,
  ),
  dipLookback: {
    default: 20,
    min: 2,
    integer: true,
    description: 'Bars to look back for dipPct’s recent high.',
  },
  bbPeriod: bars(
    'Entry: the close is below the lower Bollinger band of this many bars (average minus bbStd standard deviations).',
  ),
  bbStd: {
    default: 2,
    min: 0.5,
    max: 4,
    description:
      'Width of the Bollinger band for bbPeriod, in standard deviations.',
  },
  macdCross: bars(
    'Entry signal: 1 = the MACD line crosses above its signal line (momentum turning up).',
    { max: 1 },
  ),
  macdFast: {
    default: 12,
    min: 2,
    integer: true,
    description:
      'Fast EMA length of the MACD, in bars (for macdCross and macdExit).',
  },
  macdSlow: {
    default: 26,
    min: 3,
    integer: true,
    description:
      'Slow EMA length of the MACD, in bars. Must be longer than macdFast.',
  },
  macdSignal: {
    default: 9,
    min: 2,
    integer: true,
    description: 'Signal-line EMA length of the MACD, in bars.',
  },
  volumeRatio: percent(
    'Entry filter: volume is at least this many times its average of the previous volumePeriod bars (1.5 = 50% above normal), so the move has real trading behind it.',
    10,
  ),
  volumePeriod: {
    default: 20,
    min: 2,
    integer: true,
    description: 'Bars of average volume that volumeRatio compares with.',
  },
  marketSma: bars(
    'Entry filter: only buy while the whole market (SPY) closes above its moving average of this many bars. 200 is the classic bull-market filter.',
  ),
  crossExit: bars(
    'Exit: 1 = sell when the crossFast average crosses back below crossSlow.',
    { max: 1 },
  ),
  exitTrendSma: bars(
    'Exit: sell when the close falls below its moving average of this many bars.',
  ),
  rsiAbove: percent(
    'Exit: sell when RSI rises above this level (overbought).',
    99,
  ),
  breakdown: bars(
    'Exit: sell when the close is below the lowest low of the previous this-many bars.',
  ),
  stopLoss: percent(
    'Exit: sell when the close is this % below the entry price.',
    50,
  ),
  takeProfit: percent(
    'Exit: sell when the close is this % above the entry price.',
    200,
  ),
  trailingStop: percent(
    'Exit: sell when the close is this % below its highest close since entry.',
    50,
    10,
  ),
  maxHold: bars('Exit: sell after holding this many bars.'),
  macdExit: bars(
    'Exit: 1 = sell when the MACD line crosses below its signal line.',
    { max: 1 },
  ),
  atrStop: percent(
    'Exit (Chandelier stop): sell when the close falls more than this many ATRs (average bar ranges) below the highest high of the last atrPeriod bars. Adapts to how jumpy the stock is; 2-4 is typical.',
    10,
  ),
  atrPeriod: {
    default: 22,
    min: 2,
    integer: true,
    description: 'Bars for atrStop’s ATR and highest high.',
  },
  marketExit: bars(
    'Exit: 1 = sell when the whole market (SPY) closes below its marketSma average (needs marketSma).',
    { max: 1 },
  ),
  ...INFO_PARAMS,
};
