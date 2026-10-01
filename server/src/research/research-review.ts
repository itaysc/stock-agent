import {
  checkPlan,
  planKey,
  type TestPlan,
} from '../backtest/plans/test-plan.js';
import type { ResearchSession } from './research.types.js';

/** Keeps valid, new, allowed proposals (up to the round's limit); the rest get a reason. */
export function reviewProposals(
  raw: unknown,
  session: ResearchSession,
  seen: Set<string>,
) {
  const r = session.request;
  const accepted: TestPlan[] = [];
  const rejected: string[] = [];
  (Array.isArray(raw) ? raw : []).forEach((proposal, i) => {
    const check = checkPlan(proposal, r.symbols, ['walkforward']);
    const label = `proposal ${i + 1}`;
    if ('error' in check) return rejected.push(`${label}: ${check.error}`);
    const outside = check.plan.strategies.find(
      (s) => !r.strategies.includes(s),
    );
    if (outside)
      return rejected.push(
        `${label}: strategy ${outside} is not allowed in this session`,
      );
    const key = planKey(check.plan);
    if (seen.has(key)) return rejected.push(`${label}: already tested`);
    if (accepted.length >= r.testsPerRound)
      return rejected.push(
        `${label}: over the ${r.testsPerRound} tests per round`,
      );
    seen.add(key);
    accepted.push(check.plan);
  });
  return { accepted, rejected };
}
