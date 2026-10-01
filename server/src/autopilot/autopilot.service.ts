import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { DeploymentStore } from '../paper/deployment-store.js';
import type { Deployment } from '../paper/deployment.types.js';
import { DeploymentsService } from '../paper/deployments.service.js';
import { ResearchService } from '../research/research.service.js';
import { BASKETS } from '../research/robustness/baskets.js';
import { AutopilotStore } from './autopilot-store.js';
import type {
  AutopilotDecision,
  AutopilotRun,
  AutopilotSettings,
} from './autopilot.types.js';
import { NotifierService } from '../notify/notifier.service.js';
import { nextSymbols, runSummary } from './autopilot-helpers.js';
import { researchAndDeploy } from './autopilot-research.js';
import { researchStep } from './research-step.js';
import { IdeasService } from './ideas/ideas.service.js';
import { retireReason } from './retirement.js';

/**
 * The autonomous loop: retire its failing paper deployments, research the
 * next symbols of the watchlist, and paper-deploy the ideas that pass every
 * check, within its limits. Every decision is logged (and notified).
 */
@Injectable()
export class AutopilotService {
  private readonly logger = new Logger(AutopilotService.name);
  private current: AutopilotRun | null = null;

  constructor(
    private readonly store: AutopilotStore,
    private readonly deployments: DeploymentsService,
    private readonly deploymentStore: DeploymentStore,
    private readonly research: ResearchService,
    private readonly notifier: NotifierService,
    private readonly ideas: IdeasService,
  ) {}

  get running(): AutopilotRun | null {
    return this.current;
  }

  /**
   * Starts a run in the background (returns it right away). With `targets`
   * (e.g. /check AAPL), it researches those instead of the watchlist's next.
   */
  start(
    trigger: AutopilotRun['trigger'],
    targets?: Array<{ label: string; symbols: string[] }>,
  ): AutopilotRun {
    if (this.current) throw new Error('The autopilot is already running');
    const run: AutopilotRun = {
      id: randomUUID(),
      trigger,
      status: 'running',
      startedAt: new Date(),
      finishedAt: null,
      decisions: [],
      error: null,
    };
    this.current = run;
    void this.execute(run, targets).finally(() => (this.current = null));
    return run;
  }

  /** Retires failing autopilot deployments (the hourly check). Returns the decisions. */
  async review(settings: AutopilotSettings): Promise<AutopilotDecision[]> {
    const decisions: AutopilotDecision[] = [];
    const mine = (await this.deploymentStore.live()).filter(
      (d) => d.source.kind === 'autopilot',
    );
    for (const d of mine) {
      const reason = retireReason(d, settings.retireBehindAfterDays);
      if (!reason) continue;
      await this.deployments.stop(d.id, `Retired by the autopilot: ${reason}`);
      decisions.push({
        kind: 'retired',
        deploymentId: d.id,
        message: `Retired "${d.name}": ${reason}`,
      });
    }
    return decisions;
  }

  private async execute(
    run: AutopilotRun,
    only?: Array<{ label: string; symbols: string[] }>,
  ): Promise<void> {
    const settings = await this.store.settings();
    const note = async (decision: AutopilotDecision) => {
      run.decisions.push(decision);
      await this.store.saveRun(run);
    };
    const doing = (step: string, researchId: string | null = null) =>
      (run.activity = { step, researchId, since: new Date() });
    doing('checking its paper deployments');
    await this.store.saveRun(run);
    try {
      for (const d of await this.review(settings)) await note(d);
      const live = await this.deploymentStore.live();
      const mine = live.filter((d) => d.source.kind === 'autopilot');
      for (const d of mine)
        await note({
          kind: 'kept',
          deploymentId: d.id,
          message: `Kept "${d.name}" (${d.status})`,
        });
      const slots = { left: settings.maxDeployments - mine.length };
      const targets = only ?? (await this.nextTargets(settings, live, note));
      for (const target of targets) {
        await researchAndDeploy(
          {
            research: this.research,
            deployments: this.deployments,
            ideas: this.ideas,
          },
          target,
          settings,
          note,
          slots,
          (session) =>
            doing(
              `researching ${target.label}: ${researchStep(session)}`,
              session.id,
            ),
        );
      }
      run.status = 'done';
    } catch (err) {
      run.status = 'failed';
      run.error = (err as Error).message;
      this.logger.error(`Autopilot run failed: ${run.error}`);
    }
    run.finishedAt = new Date();
    run.activity = null;
    if (!only) settings.lastRunAt = run.startedAt;
    await this.store.saveSettings(settings);
    await this.store.saveRun(run);
    await this.notify(run);
  }

  /** The watchlist's next symbols and the next group (and moves both rotations on). */
  private async nextTargets(
    settings: AutopilotSettings,
    live: Deployment[],
    note: (d: AutopilotDecision) => Promise<void>,
  ) {
    const owned = new Set(
      live.flatMap((d) => d.sleeves.flatMap((s) => s.symbols)),
    );
    const { picked, next } = nextSymbols(
      settings.watchlist,
      settings.nextIndex,
      settings.symbolsPerRun,
      owned,
    );
    settings.nextIndex = next;
    const targets = picked.map((symbol) => ({
      label: symbol,
      symbols: [symbol],
    }));
    // One group per run (e.g. sector ETFs), for strategies that rotate between symbols.
    if (settings.groups.length) {
      const basket =
        settings.groups[settings.nextGroup % settings.groups.length];
      settings.nextGroup = (settings.nextGroup + 1) % settings.groups.length;
      const symbols = [...BASKETS[basket].symbols];
      const taken = symbols.filter((x) => owned.has(x));
      if (taken.length)
        await note({
          kind: 'skipped',
          message: `${BASKETS[basket].name}: ${taken.join(', ')} already traded by a deployment`,
        });
      else targets.push({ label: BASKETS[basket].name, symbols });
    }
    return targets;
  }

  private async notify(run: AutopilotRun): Promise<void> {
    await this.notifier.send(runSummary(run));
  }
}
