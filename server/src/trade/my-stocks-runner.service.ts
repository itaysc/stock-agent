import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlpacaService } from '../alpaca/alpaca.service.js';
import { BacktestService } from '../backtest/backtest.service.js';
import type { Env } from '../config/env.js';
import { NotifierService } from '../notify/notifier.service.js';
import { levelHit } from '../paper/manual-exits.js';
import { completedBefore } from '../paper/market-clock.js';
import { reconcileLedger } from '../paper/reconcile.js';
import { MyStocksService } from './my-stocks.service.js';
import { MyStocksStore } from './my-stocks.store.js';
import { AlpacaAccounts } from '../accounts/alpaca-accounts.service.js';

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/**
 * Every minute: books the fills of your Trade-page orders (and tells you on
 * Telegram), and after each new daily close sells a stock whose close
 * crossed your own stop loss or profit target.
 */
@Injectable()
export class MyStocksRunner
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(MyStocksRunner.name);
  private timer?: ReturnType<typeof setInterval>;
  private busy: Promise<void> = Promise.resolve();

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly alpaca: AlpacaService,
    private readonly store: MyStocksStore,
    private readonly myStocks: MyStocksService,
    private readonly backtests: BacktestService,
    private readonly notifier: NotifierService,
    private readonly accounts: AlpacaAccounts,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.get('PAPER_TRADING_ENABLED', { infer: true })) return;
    this.timer = setInterval(() => void this.tick(), MINUTE_MS);
    void this.tick();
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  /** Every account's fills and levels (paper accounts only). */
  tick(): Promise<void> {
    this.busy = this.busy.then(() =>
      this.accounts.forEach('My stocks check', async () => {
        if (!this.alpaca.isPaper) return;
        await this.bookFills();
        await this.checkLevels();
      }),
    );
    return this.busy;
  }

  /** New fills of pending orders go into your ledger. */
  async bookFills(): Promise<void> {
    if (!(await this.store.get()).ledger.pending.length) return;
    const now = new Date();
    const events = await this.store.update(async (m) => {
      const lines = await reconcileLedger(
        m.ledger,
        async (id) => {
          const o = await this.alpaca
            .getOrderByClientOrderId(id)
            .catch((err: Error) => {
              if (err.name === 'NotFoundError') return null;
              throw err;
            });
          return o
            ? {
                status: String(o.status),
                filledQty: Number(o.filledQty ?? 0),
                filledAvgPrice: o.filledAvgPrice
                  ? Number(o.filledAvgPrice)
                  : null,
              }
            : null;
        },
        now,
      );
      for (const message of lines) m.events.push({ timestamp: now, message });
      return lines;
    });
    for (const e of events) await this.notifier.send(`My stocks: ${e}`);
  }

  /** After a new daily close: your levels, checked once on that close. */
  async checkLevels(): Promise<void> {
    const m = await this.store.get();
    const symbols = Object.keys(m.levels).filter((s) => m.ledger.positions[s]);
    if (!symbols.length) return;
    const cutoff = completedBefore(await this.alpaca.getClock());
    const bars = await this.backtests.fetchBars(symbols, {
      timeframe: '1Day',
      from: new Date(cutoff.getTime() - 10 * DAY_MS),
      to: cutoff,
    });
    const last = (s: string) =>
      (bars[s] ?? []).filter((b) => b.timestamp < cutoff).at(-1);
    const newest = symbols
      .map((s) => last(s)?.timestamp.getTime() ?? 0)
      .reduce((a, b) => Math.max(a, b), 0);
    if (
      !newest ||
      (m.levelsCheckedAt && +new Date(m.levelsCheckedAt) >= newest)
    )
      return;
    const hit: string[] = [];
    for (const s of symbols) {
      const bar = last(s);
      const why = bar && levelHit(m.levels[s], bar.close);
      const pending = m.ledger.pending.some(
        (p) => p.symbol === s && p.side === 'sell',
      );
      if (!bar || !why || pending) continue;
      await this.myStocks.sellAllFor(
        s,
        m.ledger.positions[s].qty,
        bar.close,
        why,
      );
      hit.push(s);
      await this.notifier.send(`My stocks: selling all ${s}, ${why}`);
    }
    await this.store.update((x) => {
      x.levelsCheckedAt = new Date(newest);
      for (const s of hit) delete x.levels[s];
    });
  }
}
