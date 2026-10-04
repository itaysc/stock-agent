import { DEFAULT_PARAMS } from '../universe.js';

const run = (name: string, over: Record<string, string>) => ({
  name,
  grid: Object.fromEntries(
    Object.entries({ ...DEFAULT_PARAMS, ...over }).map(([k, v]) => [k, [v]]),
  ),
  tuned: [] as string[],
});

/** Each idea on Aggressive (a) and Balanced (b, market filter 200), at the broker's own settings. */
const both = (name: string, over: Record<string, string> = {}) => [
  run(`a ${name}`, over),
  run(`b ${name}`, { marketFilter: '200', ...over }),
];

/**
 * Three ideas from the momentum research: steady risers first ("frog in the
 * pan"), a 3/6/12-month score, and holding the stocks smaller when, together,
 * they swing hard (momentum's worst crashes come in wild markets).
 */
export const SIGNALS = [
  ...both('now'),
  ...both('steadiest of top 10', { steadyPool: '10' }),
  ...both('steadiest of top 15', { steadyPool: '15' }),
  ...both('3/6/12-month score', { rankBy: '4' }),
  ...both('smaller above 20% swings', { basketVol: '20' }),
  ...both('smaller above 25% swings', { basketVol: '25' }),
  ...both('smaller above 30% swings', { basketVol: '30' }),
];

/** Buy the top 5, keep each until it falls out of the top N: fewer trades (and taxes). */
export const HOLD_BAND = [
  ...both('now'),
  ...both('keep while top 7', { keepRank: '7' }),
  ...both('keep while top 10', { keepRank: '10' }),
  ...both('keep while top 15', { keepRank: '15' }),
];

/** Ideas from the research: residual momentum, the 52-week high, and industry momentum. */
export const RESEARCH = [
  ...both('now'),
  ...both('residual momentum', { rankBy: '5' }),
  ...both('nearest 52-week high', { rankBy: '6' }),
  ...both('top 3 sectors only', { sectorTop: '3' }),
  ...both('top 2 sectors only', { sectorTop: '2' }),
];
