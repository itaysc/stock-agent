import type { DeploymentsService } from '../paper/deployments.service.js';
import { sleeveFromResearch } from '../paper/research-sleeve.js';
import type { ResearchService } from '../research/research.service.js';
import type {
  AutopilotDecision,
  AutopilotSettings,
} from './autopilot.types.js';

const YEAR_MS = 365.25 * 86_400_000;
const pct = (n: number | null | undefined) =>
  n === null || n === undefined ? 'n/a' : `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

/** Researches one symbol or group and paper-deploys it if it passed every check (and a slot is free). */
export async function researchAndDeploy(
  research: ResearchService,
  deployments: DeploymentsService,
  target: { label: string; symbols: string[] },
  settings: AutopilotSettings,
  note: (d: AutopilotDecision) => Promise<void>,
  slots: { left: number },
): Promise<void> {
  const { label, symbols } = target;
  const s = await research.runNow({
    symbols,
    timeframe: '1Day',
    from: new Date(Date.now() - 5 * YEAR_MS),
    to: new Date(),
    holdout: settings.holdout,
    strategies: [],
    goal: settings.goal,
    rounds: settings.rounds,
    testsPerRound: settings.testsPerRound,
    initialCash: settings.capitalPerDeployment,
    slippageBps: 5,
    feePerShare: 0,
    cashYieldPct: 3,
    basket: settings.basket,
  });
  if (s.status === 'failed') {
    await note({
      kind: 'error',
      researchId: s.id,
      message: `Research on ${label} failed: ${s.error}`,
    });
    return;
  }
  const o = s.holdout?.outcome;
  await note({
    kind: 'researched',
    researchId: s.id,
    message: `${label}: ${s.candidate ? 'passed every check' : 'did not pass every check'} (hidden final year ${pct(o?.returnPct)} vs holding ${pct(o?.holdReturnPct)}; ${s.robustness?.summary.verdict ?? 'no multi-symbol check'})`,
  });
  if (!s.candidate) return;
  if (slots.left <= 0) {
    await note({
      kind: 'skipped',
      researchId: s.id,
      message: `${label}: no free slot (max ${settings.maxDeployments} autopilot deployments)`,
    });
    return;
  }
  try {
    const d = await deployments.create({
      name: `Autopilot: ${label}`,
      sleeves: [sleeveFromResearch(s, false)],
      capital: settings.capitalPerDeployment,
      source: { kind: 'autopilot', researchId: s.id },
    });
    slots.left--;
    await note({
      kind: 'deployed',
      deploymentId: d.id,
      researchId: s.id,
      message: `Paper-deployed ${label} with $${settings.capitalPerDeployment.toLocaleString('en-US')}: ${d.sleeves[0].strategy}`,
    });
  } catch (err) {
    await note({
      kind: 'skipped',
      researchId: s.id,
      message: `${label}: could not deploy (${(err as Error).message})`,
    });
  }
}
