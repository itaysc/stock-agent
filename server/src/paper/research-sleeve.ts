import type { Sleeve } from '../backtest/portfolio/portfolio.types.js';
import type { ResearchSession } from '../research/research.types.js';

/**
 * The AI agent's best idea as a sleeve: its strategy with the setting its
 * walk-forward picked on the latest training window, on the session's symbols.
 */
export function sleeveFromResearch(
  s: ResearchSession,
  allowNonCandidate: boolean,
): Sleeve {
  if (s.status !== 'done' || !s.holdout)
    throw new Error('The research session has not finished');
  if (!s.candidate && !allowNonCandidate) {
    throw new Error(
      'This research did not pass every check (holdout and multi-symbol): not a paper-trading candidate',
    );
  }
  const pick = s.holdout.outcome.latestPick;
  if (!pick)
    throw new Error('The best test picked no setting on its latest window');
  return {
    strategy: pick.strategy,
    symbols: s.request.symbols,
    params: pick.params,
    weightPct: 100,
  };
}
