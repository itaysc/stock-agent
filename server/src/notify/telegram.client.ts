import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';

/** Telegram allows 4,096 characters per message. */
const TELEGRAM_MAX = 4_000;

/** A button under a message: pressing it sends `data` back to the bot. */
export interface Button {
  text: string;
  data: string;
}

/** What the bot receives (only the parts it uses). */
export interface TelegramUpdate {
  update_id: number;
  message?: { chat: { id: number }; date: number; text?: string };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number }; message_id: number };
  };
}

/**
 * The Telegram Bot API, for the bot set up in TELEGRAM_BOT_TOKEN, talking to
 * TELEGRAM_CHAT_ID only. The token is part of every URL: never log a URL.
 */
@Injectable()
export class TelegramClient {
  private readonly logger = new Logger(TelegramClient.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  get chatId(): string {
    return this.config.get('TELEGRAM_CHAT_ID', { infer: true });
  }

  get configured(): boolean {
    return Boolean(this.token && this.chatId);
  }

  private get token(): string {
    return this.config.get('TELEGRAM_BOT_TOKEN', { infer: true });
  }

  /** Sends a message (with buttons, one row) to the chat. Never throws. */
  async send(text: string, buttons: Button[] = []): Promise<void> {
    if (!this.configured) return;
    await this.call('sendMessage', {
      chat_id: this.chatId,
      text: text.slice(0, TELEGRAM_MAX),
      disable_web_page_preview: true,
      ...(buttons.length && {
        reply_markup: {
          inline_keyboard: [
            buttons.map((b) => ({ text: b.text, callback_data: b.data })),
          ],
        },
      }),
    }).catch((err: Error) =>
      this.logger.warn(`Telegram notification failed: ${err.message}`),
    );
  }

  /** Calls one Bot API method; throws with Telegram's explanation (e.g. "chat not found"). */
  async call<T = unknown>(
    method: string,
    body: object,
    timeoutMs = 10_000,
    stop?: AbortSignal,
  ): Promise<T> {
    const timeout = AbortSignal.timeout(timeoutMs);
    let res: Response;
    try {
      res = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: stop ? AbortSignal.any([timeout, stop]) : timeout,
      });
    } catch {
      throw new Error(
        timeout.aborted
          ? 'timed out'
          : stop?.aborted
            ? 'stopped'
            : 'network error',
      );
    }
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: T;
      description?: string;
    };
    if (!res.ok || !json.ok)
      throw new TelegramError(
        res.status,
        `HTTP ${res.status} ${json.description ?? ''}`.trim(),
      );
    return json.result as T;
  }
}

export class TelegramError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
