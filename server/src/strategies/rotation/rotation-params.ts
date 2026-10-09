import type { ParamSpec, ParamSpecs } from '../strategy-params.js';

const whole = (
  dflt: number,
  min: number,
  max: number | undefined,
  description: string,
): ParamSpec => ({
  default: dflt,
  min,
  ...(max === undefined ? {} : { max }),
  integer: true,
  description,
});
const flag = (dflt: 0 | 1, description: string): ParamSpec => ({
  default: dflt,
  min: 0,
  max: 1,
  integer: true,
  description,
});

/** Settings of the momentum rotation (see MomentumRotationStrategy). */
export const ROTATION_PARAMS: ParamSpecs = {
  lookback: whole(
    126,
    2,
    undefined,
    'Ranking window: each symbol’s return over this many bars (126 ≈ 6 months, 252 ≈ a year).',
  ),
  skipRecent: whole(
    0,
    0,
    undefined,
    'Leave out the last this-many bars when ranking (21 = skip the last month, the classic "12-1" momentum).',
  ),
  recentDrop: {
    default: 0,
    min: 0,
    max: 90,
    zeroIsOff: true,
    description:
      'Don’t buy a stock that fell more than this % over the last month (21 bars), however strong its year. 0 = off.',
  },
  recentDropHeld: flag(
    0,
    '1 = recentDrop also sells a stock it already holds (at the re-check); 0 = it only blocks new buys.',
  ),
  topN: whole(2, 1, 100, 'How many of the best-ranked symbols to hold.'),
  rebalanceDays: whole(
    21,
    1,
    undefined,
    'Re-rank and rebalance every this many bars (21 ≈ monthly).',
  ),
  tranches: whole(
    0,
    0,
    21,
    "Split the money into this many parts, re-ranking one part each day (it holds the average of the last this-many days' picks), so no single re-rank day decides the result. 0 or 1 = off (all of it on the re-rank day).",
  ),
  lookbackMix: flag(
    0,
    '1 = a third each ranked over about 6, 9 and 12 months (instead of one window), so no single window decides the result.',
  ),
  maxStretch: whole(
    0,
    0,
    200,
    "Don't start a position in a stock more than this % above its 50-day average (held ones stay). 0 = off.",
  ),
  stretchMode: whole(
    1,
    1,
    2,
    'What happens to a pick maxStretch skips: 1 = the next-ranked stock takes its slot; 2 = the slot waits in the safe asset until it cools down.',
  ),
  crowdFilter: whole(
    0,
    0,
    2,
    'Skip the most crowded third of the best 3×topN (held ones stay): 1 = volume high against its own past year, 2 = high turnover (algo lab, SEC market value). 0 = off.',
  ),
  earningsWait: whole(
    0,
    0,
    30,
    "Don't start a position in a stock that releases earnings within this many days (held ones stay; algo lab: SEC release days). 0 = off.",
  ),
  rebalanceOffset: whole(
    0,
    0,
    100,
    'Shift the re-rank day by this many bars (e.g. 1 = a day later in each cycle), to check the day itself does not matter.',
  ),
  absMomentum: flag(
    1,
    '1 = only hold a symbol whose own return over the window is positive; its share goes to the safe asset (safeLast) or stays in cash.',
  ),
  safeLast: flag(
    0,
    '1 = the LAST symbol is the safe asset (e.g. TLT or SHY): never ranked, it gets the share no symbol qualifies for.',
  ),
  volWeight: flag(
    0,
    '1 = weigh the picks by 1 ÷ their volatility (calmer ones get more), instead of equally.',
  ),
  volLookback: whole(
    63,
    5,
    undefined,
    'Bars of daily moves for volWeight and targetVol (63 ≈ 3 months).',
  ),
  targetVol: {
    default: 0,
    min: 0,
    max: 100,
    zeroIsOff: true,
    description:
      'Scale the holdings down when their average yearly volatility is above this % (the rest stays in cash). 0 = off.',
  },
  rankBy: whole(
    0,
    0,
    6,
    'How to rank: 0 = highest return over the window (momentum); 1 = return ÷ volatility; 2 = lowest volatility (calmest first); 3 = biggest drop over the window (buy the dip); 4 = average of the returns over a quarter, half and all of the window (3, 6 and 12 months); 5 = residual momentum (how much it beat what the market explains, per unit of noise); 6 = nearest its 52-week high.',
  ),
  blend: whole(
    0,
    0,
    9,
    'Mix in the company reports (algo lab only, from SEC data): 1 momentum + value, 2 momentum + quality, 3 all three, 4 momentum among the better-quality half, 5 value + quality without momentum, 6 momentum + earnings surprise, 7 momentum + the reaction to the earnings release, 8 momentum + both surprises and the reaction, 9 momentum among the better earnings-momentum half. 0 = momentum only.',
  ),
  sectorTop: whole(
    0,
    0,
    20,
    'Only buy from the this-many sectors whose stocks rose most on average over the window (industry momentum). 0 = any sector.',
  ),
  keepRank: whole(
    0,
    0,
    100,
    'Keep a stock it holds while it still ranks in the top this-many (buy the top topN, sell only below keepRank): fewer trades. 0 = sell as soon as it leaves the top topN.',
  ),
  steadyPool: whole(
    0,
    0,
    100,
    'Of the best this-many by rank, pick the steadiest risers first (up on most days, not a few jumps). 0 = off.',
  ),
  basketVol: {
    default: 0,
    min: 0,
    max: 100,
    zeroIsOff: true,
    description:
      'Hold the stocks smaller (the rest in the safe asset) when, together, they swung more than this % a year over the last 6 months. 0 = off.',
  },
  trendSma: whole(
    0,
    0,
    400,
    'Only hold a symbol while its close is above its own average of this many days (200 is classic); 0 = off.',
  ),
  marketFilter: whole(
    0,
    0,
    400,
    'Hold nothing risky while SPY is below its average of this many days (200 is classic); 0 = off.',
  ),
  stopPct: {
    default: 0,
    min: 0,
    max: 90,
    zeroIsOff: true,
    description:
      'Sell a holding (checked daily) when it falls this % below its highest close since it was bought. 0 = off.',
  },
  takeProfitPct: {
    default: 0,
    min: 0,
    max: 1000,
    zeroIsOff: true,
    description:
      'Sell a holding (checked daily) once it is up this % from its buy price. 0 = off.',
  },
  maxPerSector: whole(
    0,
    0,
    20,
    'Hold at most this many symbols from one sector (2 = no more than two tech stocks); the next-best from other sectors take the slots. 0 = no limit.',
  ),
  guardPct: {
    default: 0,
    min: 0,
    max: 90,
    zeroIsOff: true,
    description:
      'Crash guard: when the whole account falls this % below its peak, sell everything into the safe asset and wait. 0 = off.',
  },
  guardDays: whole(
    21,
    1,
    500,
    'Crash guard: wait at least this many trading days before buying again.',
  ),
  guardResume: flag(
    0,
    '1 = after a crash-guard sale, also wait until SPY is back above its 200-day average.',
  ),
  fractional: flag(
    0,
    '1 = buy fractional shares (e.g. 0.25 of a share), so small accounts can hold pricey stocks.',
  ),
  band: {
    default: 2,
    min: 0,
    max: 50,
    description:
      'Skip trades smaller than this % of the account, to avoid churning.',
  },
};

/** Rotation replaces the usual allocation with the share of the account to keep invested. */
export const ROTATION_ALLOCATION: ParamSpec = {
  default: 1,
  min: 0.01,
  max: 1,
  description:
    'Share of the account the rotation keeps invested (1 = all of it; the rest stays in cash).',
};
