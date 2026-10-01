import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';

/** Posts short messages to NOTIFY_WEBHOOK_URL (e.g. a Slack incoming webhook), when set. */
@Injectable()
export class NotifierService {
  private readonly logger = new Logger(NotifierService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  get configured(): boolean {
    return this.config.get('NOTIFY_WEBHOOK_URL', { infer: true }) !== '';
  }

  async send(text: string): Promise<void> {
    const url = this.config.get('NOTIFY_WEBHOOK_URL', { infer: true });
    if (!url) return;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) this.logger.warn(`Notification failed: HTTP ${res.status}`);
    } catch (err) {
      this.logger.warn(`Notification failed: ${(err as Error).message}`);
    }
  }
}
