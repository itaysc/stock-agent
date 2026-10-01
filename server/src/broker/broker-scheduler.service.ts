import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { BrokerService } from './broker.service.js';

const EVERY_MS = 15 * 60_000;

/** Every 15 minutes (with the paper runner on): the daily report once a new day is in, and the monthly health check. */
@Injectable()
export class BrokerSchedulerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(BrokerSchedulerService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly broker: BrokerService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.get('PAPER_TRADING_ENABLED', { infer: true })) return;
    this.timer = setInterval(() => void this.tick(), EVERY_MS);
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  async tick(now = new Date()): Promise<void> {
    try {
      await this.broker.reportIfNew();
      await this.broker.checkIfDue(now);
    } catch (err) {
      this.logger.error(`Broker check failed: ${(err as Error).message}`);
    }
  }
}
