import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import {
  accountOfButton,
  TelegramClient,
  TelegramError,
  type TelegramUpdate,
} from '../../notify/telegram.client.js';
import { BotCommands, type Reply } from './bot-commands.js';
import { AccountContext } from '../../accounts/account-context.js';
import { AlpacaAccounts } from '../../accounts/alpaca-accounts.service.js';

/** Messages older than this (e.g. sent while the server was down) are ignored. */
const STALE_S = 10 * 60;

/**
 * Reads your Telegram replies (long polling: no public URL or webhook
 * needed) and answers them. Only TELEGRAM_CHAT_ID is listened to: anyone
 * else who finds the bot is ignored.
 */
@Injectable()
export class TelegramBotService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(TelegramBotService.name);
  private readonly stop = new AbortController();
  private offset = 0;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly telegram: TelegramClient,
    private readonly commands: BotCommands,
    private readonly accounts: AlpacaAccounts,
  ) {}

  get enabled(): boolean {
    return (
      this.telegram.configured &&
      this.config.get('TELEGRAM_COMMANDS_ENABLED', { infer: true })
    );
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) return;
    this.logger.log('Listening for Telegram commands');
    void this.loop();
  }

  onApplicationShutdown(): void {
    this.stop.abort();
  }

  private async loop(): Promise<void> {
    let warned = false;
    while (!this.stop.signal.aborted) {
      try {
        const updates = await this.telegram.call<TelegramUpdate[]>(
          'getUpdates',
          {
            offset: this.offset,
            timeout: 30,
            allowed_updates: ['message', 'callback_query'],
          },
          40_000,
          this.stop.signal,
        );
        warned = false;
        for (const u of updates) {
          this.offset = u.update_id + 1;
          await this.handle(u);
        }
      } catch (err) {
        if (this.stop.signal.aborted) return;
        const conflict = err instanceof TelegramError && err.status === 409;
        if (!warned)
          this.logger.warn(
            conflict
              ? 'Another app reads this bot (a second server, or a webhook set on it): commands paused, retrying every minute'
              : `Telegram commands: ${(err as Error).message}, retrying`,
          );
        warned = true;
        await this.wait(conflict ? 60_000 : 10_000);
      }
    }
  }

  /** Answers one update (exported for tests). */
  async handle(u: TelegramUpdate, now = Date.now()): Promise<void> {
    const mine = (id: number | undefined) =>
      id !== undefined && String(id) === this.telegram.chatId;
    try {
      if (u.message?.text && mine(u.message.chat.id)) {
        if (now / 1000 - u.message.date > STALE_S) return;
        // Typed commands: the first account (ideas answer in their own).
        const text = u.message.text;
        await this.inAccount(undefined, async () =>
          this.reply(await this.commands.text(text)),
        );
      } else if (u.callback_query) {
        const q = u.callback_query;
        if (!mine(q.message?.chat.id)) {
          await this.answer(q.id, 'Not allowed');
          return;
        }
        await this.answer(q.id, 'Working on it…');
        // The buttons are used up: remove them so they can't be pressed twice.
        if (q.message)
          await this.telegram
            .call('editMessageReplyMarkup', {
              chat_id: this.telegram.chatId,
              message_id: q.message.message_id,
              reply_markup: { inline_keyboard: [] },
            })
            .catch(() => undefined);
        const { data, account } = accountOfButton(q.data ?? '');
        await this.inAccount(account, async () =>
          this.reply(await this.commands.button(data)),
        );
      }
    } catch (err) {
      this.logger.error(`Telegram command failed: ${(err as Error).message}`);
      await this.telegram.send(
        `Something went wrong: ${(err as Error).message}`,
      );
    }
  }

  /** Runs `fn` in the account (a button's), else the first one. */
  private inAccount(id: string | undefined, fn: () => Promise<void>) {
    const account =
      (id ? this.accounts.get(id) : undefined) ?? this.accounts.first();
    if (!account) return this.telegram.send('No Alpaca account in the app');
    return AccountContext.run(account, fn);
  }

  private reply(r: Reply): Promise<void> {
    if (r === '') return Promise.resolve(); // already answered (e.g. /report)
    return typeof r === 'string'
      ? this.telegram.send(r)
      : this.telegram.send(r.text, r.buttons);
  }

  private answer(id: string, text: string): Promise<unknown> {
    return this.telegram
      .call('answerCallbackQuery', { callback_query_id: id, text })
      .catch(() => undefined);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const t = setTimeout(resolve, ms);
      this.stop.signal.addEventListener('abort', () => {
        clearTimeout(t);
        resolve();
      });
    });
  }
}
