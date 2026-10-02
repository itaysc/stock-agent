import { DEFAULT_PARAMS } from './universe.js';

export type ProfileId = 'aggressive' | 'balanced' | 'careful';

/** SPY while it is above its 200-day average, otherwise short T-bills (SHV): the calm part of a mix. */
export const INDEX_SYMBOLS = ['SPY', 'SHV'];
export const INDEX_PARAMS: Record<string, string> = {
  lookback: '21',
  topN: '1',
  rebalanceDays: '5',
  volWeight: '0',
  absMomentum: '0',
  safeLast: '1',
  marketFilter: '200',
  band: '0.5',
  fractional: '1',
};

export interface ProfileSleeve {
  /** momentum: the 50 stocks (DEFAULT_PARAMS + extra); index: SPY with the 200-day filter. */
  kind: 'momentum' | 'index';
  weightPct: number;
  params: Record<string, string>;
}

export interface Profile {
  id: ProfileId;
  name: string;
  /** One line: what it does. */
  summary: string;
  sleeves: ProfileSleeve[];
  /** Telegram asks you (sell all / keep going) when the account falls this % below its peak. */
  alertPct: number;
}

const momentum = (
  weightPct: number,
  extra: Record<string, string> = {},
): ProfileSleeve => ({
  kind: 'momentum',
  weightPct,
  params: { ...DEFAULT_PARAMS, ...extra },
});
const index = (weightPct: number): ProfileSleeve => ({
  kind: 'index',
  weightPct,
  params: INDEX_PARAMS,
});

/**
 * From most growth (and the deepest drops) to the most safety; their numbers
 * are in profile-stats.data.ts (from the algo lab). A 70/30 momentum + S&P mix
 * was dropped: Balanced earned as much with a smaller worst drop.
 */
export const PROFILES: Profile[] = [
  {
    id: 'aggressive',
    name: 'Aggressive',
    summary:
      'All in the 5 strongest stocks. The most growth, and the deepest drops in a crash.',
    sleeves: [momentum(100)],
    alertPct: 30,
  },
  {
    id: 'balanced',
    name: 'Balanced',
    summary:
      'The 5 strongest stocks, moving to T-bills whenever the S&P 500 is below its 200-day average.',
    sleeves: [momentum(100, { marketFilter: '200' })],
    alertPct: 20,
  },
  {
    id: 'careful',
    name: 'Careful',
    summary:
      'Half in the strongest stocks, half in the S&P 500, both moving to T-bills when the market is down.',
    sleeves: [momentum(50, { marketFilter: '200' }), index(50)],
    alertPct: 15,
  },
];

export const profileById = (id: string) => PROFILES.find((p) => p.id === id);

/** Your rule of thumb: more risk for small amounts, more safety for big ones (upper bounds, in $). */
export const AMOUNT_RULES: Array<{
  below: number;
  profile: ProfileId;
  why: string;
}> = [
  {
    below: 2_000,
    profile: 'aggressive',
    why: 'a small amount: room for higher risk and higher growth',
  },
  {
    below: 25_000,
    profile: 'balanced',
    why: 'a medium amount: most of the growth, with protection in market crashes',
  },
  {
    below: Infinity,
    profile: 'careful',
    why: 'a big amount: the safety net comes first',
  },
];

export function suggestProfile(capital: number) {
  const rule =
    AMOUNT_RULES.find((r) => capital < r.below) ??
    AMOUNT_RULES[AMOUNT_RULES.length - 1];
  return { profile: rule.profile, why: rule.why };
}
