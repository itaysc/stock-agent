import type { Sleeve } from '../../backtest/portfolio/portfolio.types.js';

/** How long an idea can be accepted: after that the research is stale. */
export const IDEA_DAYS = 3;

export type IdeaStatus =
  'pending' | 'invested' | 'skipped' | 'expired' | 'replaced';

/**
 * An investment idea the autopilot found (it passed every check), waiting for
 * your yes or no (in Telegram or the Lab) before it paper-deploys it.
 */
export interface Idea {
  /** Short, to type in Telegram: /invest k3f9. */
  id: string;
  label: string;
  symbols: string[];
  researchId: string;
  sleeve: Sleeve;
  /** The amount suggested (the autopilot's capitalPerDeployment). */
  capital: number;
  /** The evidence, as sent. */
  message: string;
  status: IdeaStatus;
  /** Why it ended (e.g. the deploy error), or the deployment it made. */
  outcome: string | null;
  deploymentId: string | null;
  createdAt: Date;
  expiresAt: Date;
}
