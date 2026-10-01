import { ENTRY_RULES, EXIT_RULES } from './rules-params.js';

type Resolved = Record<string, number>;

/** The market the market filter (marketSma, marketExit) looks at. */
export const MARKET_SYMBOL = 'SPY';

/** Checks the combination of rules (the per-param limits are checked by their specs). */
export function validateRules(p: Resolved): void {
  if (!ENTRY_RULES.some((r) => p[r] > 0)) {
    throw new Error(
      `rules needs at least one entry rule (${ENTRY_RULES.join(', ')})`,
    );
  }
  if (!EXIT_RULES.some((r) => p[r] > 0)) {
    throw new Error(
      `rules needs at least one exit rule (${EXIT_RULES.join(', ')})`,
    );
  }
  if (
    (p.crossFast > 0 || p.crossSlow > 0) &&
    !(p.crossFast > 0 && p.crossFast < p.crossSlow)
  ) {
    throw new Error(
      `crossFast must be less than crossSlow, both on (${p.crossFast} vs ${p.crossSlow})`,
    );
  }
  if (p.crossExit > 0 && p.crossSlow === 0) {
    throw new Error('crossExit needs crossFast and crossSlow');
  }
  if (p.rsiBelow > 0 && p.rsiAbove > 0 && p.rsiBelow >= p.rsiAbove) {
    throw new Error(
      `rsiBelow must be less than rsiAbove (${p.rsiBelow} vs ${p.rsiAbove})`,
    );
  }
  if ((p.macdCross > 0 || p.macdExit > 0) && p.macdFast >= p.macdSlow) {
    throw new Error(
      `macdFast must be less than macdSlow (${p.macdFast} vs ${p.macdSlow})`,
    );
  }
  if (p.marketExit > 0 && p.marketSma === 0) {
    throw new Error('marketExit needs marketSma');
  }
}

type ParamValues = Record<string, string | string[] | number | undefined>;

/** Whether any value given for any of `names` turns that block on. */
const anyOn = (strategies: string[], params: ParamValues, names: string[]) =>
  strategies.includes('rules') &&
  names.some((n) => [params[n] ?? []].flat().some((v) => Number(v) > 0));

/** Whether any setting of these strategies and param values reads SPY (market filter, market volatility). */
export function usesMarket(strategies: string[], params: ParamValues): boolean {
  return anyOn(strategies, params, ['marketSma', 'volMax', 'volExit']);
}

/**
 * The information beyond prices that any setting needs (see InfoService).
 * `newsGateTone`: the pre-open news check needs news for every strategy.
 */
export function infoNeeds(
  strategies: string[],
  params: ParamValues,
  newsGateTone = 0,
) {
  return {
    news:
      newsGateTone > 0 || anyOn(strategies, params, ['newsFilter', 'newsExit']),
    earnings: anyOn(strategies, params, [
      'earningsAvoid',
      'surpriseMin',
      'earningsExit',
    ]),
  };
}
