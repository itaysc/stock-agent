import type { ParamSpec, ParamSpecs } from '../strategy-params.js';

const off = (description: string, spec: Partial<ParamSpec>): ParamSpec => ({
  default: 0,
  min: 0,
  zeroIsOff: true,
  description: `${description} 0 = off.`,
  ...spec,
});
const whole = (dflt: number, min: number, description: string): ParamSpec => ({
  default: dflt,
  min,
  integer: true,
  description,
});

/** Blocks that use information beyond the symbol's own prices: market volatility, news, earnings. */
export const INFO_PARAMS: ParamSpecs = {
  volMax: off(
    'Entry filter: only buy while the whole market (SPY) is calm: its yearly volatility over the last volPeriod days is below this % (about 15 is calm, 30+ is turbulent).',
    { max: 200 },
  ),
  volPeriod: whole(20, 5, 'Days of SPY moves for volMax and volExit.'),
  newsFilter: off(
    'Entry filter: 1 = only buy when the headlines of the last newsDays days average at least newsMin (tone -1 to +1; no news counts as 0).',
    { integer: true, max: 1 },
  ),
  newsMin: {
    default: 0.1,
    min: -1,
    max: 1,
    description:
      'Minimum average headline tone for newsFilter (-1 very negative, 0 neutral, +1 very positive).',
  },
  newsDays: whole(
    5,
    1,
    'Days of headlines averaged by newsFilter and newsExit.',
  ),
  earningsAvoid: off(
    "Entry filter: don't buy within this many days before the next earnings report (needs ALPHAVANTAGE_API_KEY).",
    { integer: true, max: 60 },
  ),
  surpriseMin: off(
    'Entry signal: buy within surpriseDays after an earnings report that beat the estimate by at least this % (post-earnings drift; needs ALPHAVANTAGE_API_KEY).',
    { max: 500 },
  ),
  surpriseDays: whole(10, 1, 'Days after a report that surpriseMin may buy.'),
  volExit: off(
    "Exit: sell when the market's (SPY) yearly volatility rises above this %.",
    { max: 200 },
  ),
  newsExit: off(
    'Exit: sell when the headlines of the last newsDays days average this negative or worse (0.2 = tone -0.2 or below).',
    { max: 1 },
  ),
  targetVol: off(
    'Position size: buy less when the stock is jumpy, so the position carries about this % yearly volatility (e.g. 20; a stock at 40% volatility gets half the usual size).',
    { max: 100 },
  ),
  targetVolDays: whole(63, 5, 'Days of moves for targetVol (63 ≈ 3 months).'),
  earningsExit: off(
    'Exit: sell this many days before the next earnings report (needs ALPHAVANTAGE_API_KEY).',
    { integer: true, max: 60 },
  ),
};

/** Entry and exit rules among the info blocks (see ENTRY_RULES / EXIT_RULES). */
export const INFO_ENTRY_RULES = [
  'volMax',
  'newsFilter',
  'earningsAvoid',
  'surpriseMin',
];
export const INFO_EXIT_RULES = ['volExit', 'newsExit', 'earningsExit'];
