import type { ResearchSession } from '../research/research.types.js';

/** Where a research session is, in plain words. */
export function researchStep(s: ResearchSession): string {
  const r = s.request;
  if (s.status === 'failed') return 'the research failed';
  if (s.status === 'done') return 'done';
  if (s.robustness) return 'writing its verdict';
  if (s.holdout) return `checking the best setup on similar symbols`;
  const round = s.rounds.at(-1);
  if (!round) return `round 1 of ${r.rounds}: deciding what to test`;
  const tests = s.experiments.length;
  return `round ${round.round} of ${r.rounds}: ${tests} test${tests === 1 ? '' : 's'} run so far`;
}
