import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { type Button, TelegramClient } from './telegram.client.js';

/**
 * Sends short messages (autopilot decisions and ideas, breaking news on
 * holdings) to every channel that's set up: a Telegram bot
 * (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID) and/or a webhook
 * (NOTIFY_WEBHOOK_URL, e.g. Slack). Never throws: a failed notification is
 * only logged.
 */
@Injectable()
export class NotifierService {
  private readonly logger = new Logger(NotifierService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly telegram: TelegramClient,
  ) {}

  get configured(): boolean {
    return this.channels().length > 0;
  }

  /** The channels that are set up, e.g. ["telegram", "webhook"]. */
  channels(): string[] {
    return [
      ...(this.telegram.configured ? ['telegram'] : []),
      ...(this.webhook ? ['webhook'] : []),
    ];
  }

  /** Buttons only show in Telegram (the webhook gets the text). */
  async send(text: string, buttons: Button[] = []): Promise<void> {
    await Promise.all([
      this.telegram.send(text, buttons),
      this.sendWebhook(text),
    ]);
  }

  private get webhook(): string {
    return this.config.get('NOTIFY_WEBHOOK_URL', { infer: true });
  }

  private async sendWebhook(text: string): Promise<void> {
    if (!this.webhook) return;
    try {
      const res = await fetch(this.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok)
        this.logger.warn(`Webhook notification failed: HTTP ${res.status}`);
    } catch (err) {
      this.logger.warn(
        `Webhook notification failed: ${(err as Error).name === 'TimeoutError' ? 'timed out' : 'network error'}`,
      );
    }
  }
}
