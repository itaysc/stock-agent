import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { BrokerNoticesService } from './broker-notices.service.js';

const EVERY_MS = 5 * 60_000;

/** Every 5 minutes (with the paper runner on): new fills, the daily update once a new day is in, and the monthly health check. */
@Injectable()
export class BrokerSchedulerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(BrokerSchedulerService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly notices: BrokerNoticesService,
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
      await this.notices.notifyFills();
      await this.notices.reportIfNew();
      await this.notices.checkIfDue(now);
    } catch (err) {
      this.logger.error(`Broker check failed: ${(err as Error).message}`);
    }
  }
}
