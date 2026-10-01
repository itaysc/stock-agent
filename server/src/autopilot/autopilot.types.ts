import type { ResearchGoal } from '../research/research.types.js';
import type { BasketId } from '../research/robustness/baskets.js';

/** The autopilot's settings (one document; off until you turn it on). */
export interface AutopilotSettings {
  enabled: boolean;
  /** Symbols it researches, one at a time, taking turns. */
  watchlist: string[];
  /** Run every this many days. */
  everyDays: number;
  /** Symbols researched per run (each is an AI research session, a few cents each). */
  symbolsPerRun: number;
  goal: ResearchGoal;
  rounds: number;
  testsPerRound: number;
  holdout: string;
  basket: BasketId;
  /** Send each idea that passed every check to you (Telegram / the Lab) and deploy only on your yes. */
  askFirst: boolean;
  /** Paper money for each deployment it makes. */
  capitalPerDeployment: number;
  /** At most this many of its deployments at once. */
  maxDeployments: number;
  /** Retire a deployment still behind its backtest after this many trading days. */
  retireBehindAfterDays: number;
  /** Groups researched as a whole, one per run (e.g. sector ETFs, for rotation strategies). */
  groups: BasketId[];
  /** Where the watchlist and group rotations continue next run. */
  nextIndex: number;
  nextGroup: number;
  lastRunAt: Date | null;
}

export const DEFAULT_SETTINGS: AutopilotSettings = {
  enabled: false,
  watchlist: ['SPY', 'QQQ', 'IWM', 'DIA', 'XLK', 'XLF', 'XLE', 'XLV'],
  everyDays: 7,
  symbolsPerRun: 2,
  goal: 'risk-adjusted',
  rounds: 4,
  testsPerRound: 3,
  holdout: '12m',
  basket: 'indexes',
  askFirst: true,
  capitalPerDeployment: 10_000,
  maxDeployments: 3,
  retireBehindAfterDays: 40,
  groups: ['sectors'],
  nextIndex: 0,
  nextGroup: 0,
  lastRunAt: null,
};

/** One decision of a run, in plain words. */
export interface AutopilotDecision {
  kind:
    | 'retired'
    | 'kept'
    | 'researched'
    | 'proposed'
    | 'deployed'
    | 'skipped'
    | 'error';
  message: string;
  deploymentId?: string;
  researchId?: string;
  ideaId?: string;
}

export interface AutopilotRun {
  id: string;
  /** review = the hourly check between runs (only saved when it retired something); chat = a Telegram command. */
  trigger: 'schedule' | 'manual' | 'review' | 'chat';
  status: 'running' | 'done' | 'failed';
  startedAt: Date;
  finishedAt: Date | null;
  decisions: AutopilotDecision[];
  /** What it is doing right now, in plain words (null when idle or done). */
  activity?: AutopilotActivity | null;
  error: string | null;
}

export interface AutopilotActivity {
  /** e.g. "Researching SPY: round 2 of 4, 5 tests run so far". */
  step: string;
  /** The research session it is running: open it to watch the agent think. */
  researchId: string | null;
  since: Date;
}
