import { randomUUID } from 'node:crypto';
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { nextRunAt, runSummary } from './autopilot-helpers.js';
import { AutopilotStore } from './autopilot-store.js';
import { AutopilotService } from './autopilot.service.js';
import { NotifierService } from '../notify/notifier.service.js';

const HOUR_MS = 3_600_000;

/**
 * Every hour, when the autopilot is on: starts a full run when one is due
 * (every `everyDays`), otherwise only checks its deployments for retirement.
 */
@Injectable()
export class AutopilotSchedulerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(AutopilotSchedulerService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly store: AutopilotStore,
    private readonly autopilot: AutopilotService,
    private readonly notifier: NotifierService,
  ) {}

  get enabled(): boolean {
    return this.config.get('AUTOPILOT_SCHEDULER_ENABLED', { infer: true });
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) return;
    this.timer = setInterval(() => void this.tick(), HOUR_MS);
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  async tick(now = new Date()): Promise<void> {
    try {
      const settings = await this.store.settings();
      if (!settings.enabled || this.autopilot.running) return;
      const due = nextRunAt(settings.lastRunAt, settings.everyDays);
      if (!due || now >= due) {
        this.autopilot.start('schedule');
        return;
      }
      const decisions = await this.autopilot.review(settings);
      if (decisions.length === 0) return;
      const run = {
        id: randomUUID(),
        trigger: 'review' as const,
        status: 'done' as const,
        startedAt: now,
        finishedAt: new Date(),
        decisions,
        error: null,
      };
      await this.store.saveRun(run);
      await this.notifier.send(runSummary(run));
    } catch (err) {
      this.logger.error(`Autopilot check failed: ${(err as Error).message}`);
    }
  }
}
