import { planLabel } from '../../backtest/plans/plan-menu.js';
import type { ResearchSession } from '../research.types.js';

/** One line per session, for the list of past sessions. */
export function researchListItem(s: ResearchSession) {
  const champion = s.experiments.find((e) => e.id === s.championId);
  return {
    id: s.id,
    status: s.status,
    symbols: s.request.symbols,
    goal: s.request.goal,
    startedAt: s.startedAt,
    finishedAt: s.finishedAt,
    rounds: s.rounds.length,
    experiments: s.experiments.length,
    champion: champion ? planLabel(champion.plan) : null,
    holdoutReturnPct: s.holdout?.outcome.returnPct ?? null,
    holdoutHoldReturnPct: s.holdout?.outcome.holdReturnPct ?? null,
    reportUrl: s.reportUrl,
    error: s.error,
  };
}
