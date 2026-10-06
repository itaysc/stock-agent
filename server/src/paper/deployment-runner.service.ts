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
import { OrdersService } from '../orders/orders.service.js';
import { cycleFailure } from './cycle-step.js';
import { runCycle } from './deployment-cycle.js';
import { type CycleDeps, logEvent } from './deployment-events.js';
import { flatten, placeOne } from './deployment-orders.js';
import type { OrderRequest } from './sleeve-context.js';
import { createRuntime, type Runtime } from './deployment-runtime.js';
import { DeploymentStore } from './deployment-store.js';
import type { Deployment } from './deployment.types.js';
import { completedBefore } from './market-clock.js';
import { aiEarningsCheck } from './earnings-ai.js';
import { aiNewsCheck } from './news-ai.js';
import { EarningsService } from '../info/earnings.service.js';
import { EdgarService } from '../info/official/edgar.service.js';
import { HaltsService } from '../info/official/halts.service.js';
import { LlmService } from '../llm/llm.service.js';
import { NotifierService } from '../notify/notifier.service.js';

/** Buys waiting for the news check go out when the market opens within this (or is open). */
const PRE_OPEN_MS = 30 * 60_000;

/**
 * Runs paper deployments: every PAPER_TRADING_POLL_MINUTES it books fills and
 * feeds newly completed daily bars to each deployment's strategies (see
 * runCycle). Paper accounts only.
 */
@Injectable()
export class DeploymentRunnerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(DeploymentRunnerService.name);
  private readonly runtimes = new Map<string, Runtime>();
  private timer?: ReturnType<typeof setInterval>;
  private busy: Promise<void> = Promise.resolve();

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly alpaca: AlpacaService,
    private readonly backtests: BacktestService,
    private readonly orders: OrdersService,
    private readonly store: DeploymentStore,
    private readonly llm: LlmService,
    private readonly notifier: NotifierService,
    private readonly halts: HaltsService,
    private readonly edgar: EdgarService,
    private readonly earnings: EarningsService,
  ) {}

  get enabled(): boolean {
    return (
      this.config.get('PAPER_TRADING_ENABLED', { infer: true }) &&
      this.alpaca.isPaper
    );
  }

  onApplicationBootstrap(): void {
    if (!this.config.get('PAPER_TRADING_ENABLED', { infer: true })) return;
    if (!this.alpaca.isPaper) {
      this.logger.error(
        'Paper deployments are off: this is a LIVE account (paper trading only for now)',
      );
      return;
    }
    const minutes = this.config.get('PAPER_TRADING_POLL_MINUTES', {
      infer: true,
    });
    this.timer = setInterval(() => void this.tick(), minutes * 60_000);
    void this.tick();
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  /** Runs one cycle for every live deployment (one tick at a time). */
  tick(): Promise<void> {
    this.busy = this.busy.then(async () => {
      const deployments = [
        ...(await this.store.live()),
        ...(await this.store.stoppedWithPending()),
      ];
      for (const d of deployments) await this.cycle(d);
    });
    return this.busy.catch((err: Error) =>
      this.logger.error(`Paper tick failed: ${err.message}`),
    );
  }

  /** Runs one deployment's cycle now (also used right after it's created or resumed). */
  async cycle(d: Deployment): Promise<void> {
    if (!this.enabled) return;
    try {
      await runCycle(d, this.runtime(d), this.deps());
    } catch (err) {
      logEvent(d, cycleFailure(err), new Date());
      this.logger.warn(`Deployment ${d.name}: ${(err as Error).message}`);
    }
    await this.store.save(d);
  }

  /** Sells everything the deployment holds (stop). */
  async flatten(d: Deployment, reason: string): Promise<void> {
    await flatten(d, this.runtime(d), this.deps(), new Date(), reason);
  }

  /** Sends one order for a sleeve now (e.g. you sold a holding by hand). */
  async placeNow(
    d: Deployment,
    sleeve: number,
    order: OrderRequest,
    note: string,
  ): Promise<void> {
    await placeOne(d, sleeve, order, this.deps(), new Date(), note);
  }

  /** Forgets the in-memory strategies (e.g. after a stop). */
  forget(id: string): void {
    this.runtimes.delete(id);
  }

  private runtime(d: Deployment): Runtime {
    let r = this.runtimes.get(d.id);
    if (!r) {
      r = createRuntime(d);
      this.runtimes.set(d.id, r);
    }
    return r;
  }

  private deps(): CycleDeps {
    return {
      fetchDaily: (symbols, from, to, needs) =>
        this.backtests.fetchBars(
          symbols,
          { timeframe: '1Day', from, to },
          needs,
        ),
      completedBefore: async () =>
        completedBefore(await this.alpaca.getClock()),
      getOrder: async (id) => {
        const order = await this.alpaca
          .getOrderByClientOrderId(id)
          // Not found → null (the reconciler gives up after 2 days); other errors retry next tick.
          .catch((err: Error) => {
            if (err.name === 'NotFoundError') return null;
            throw err;
          });
        return order
          ? {
              status: String(order.status),
              filledQty: Number(order.filledQty ?? 0),
              filledAvgPrice: order.filledAvgPrice
                ? Number(order.filledAvgPrice)
                : null,
            }
          : null;
      },
      placeOrder: async (o) => {
        await this.orders.placeOrder({
          type: 'market',
          timeInForce: 'day',
          ...o,
        });
      },
      cashToBuy: async () => {
        const a = await this.alpaca.getAccount();
        return Number(a.nonMarginableBuyingPower ?? a.cash ?? 0);
      },
      now: () => new Date(),
      recentNews: async (symbol, since) =>
        (
          await this.alpaca.getNews({
            symbols: symbol,
            start: since,
            end: new Date(),
            newestFirst: true,
          })
        ).news.map((n) => ({
          headline: n.headline,
          createdAt: new Date(n.createdAt),
        })),
      aiNewsCheck: (symbol, headlines, purpose, mode) =>
        aiNewsCheck(this.llm, symbol, headlines, purpose, mode),
      officialEvents: async (symbol, since) => ({
        halt: await this.halts.haltOf(symbol),
        filings: await this.edgar.eightKs(symbol, since),
      }),
      nextEarnings: (symbol) =>
        this.earnings.nextReport(symbol, new Date().toISOString().slice(0, 10)),
      lastEarnings: (symbol) => this.earnings.latestResult(symbol),
      aiEarningsCheck: (symbol, result, headlines) =>
        aiEarningsCheck(this.llm, symbol, result, headlines),
      opensSoon: async () => {
        const clock = await this.alpaca.getClock();
        return (
          clock.isOpen ||
          new Date(clock.nextOpen).getTime() - Date.now() <= PRE_OPEN_MS
        );
      },
      notify: (text, buttons) => this.notifier.send(text, buttons),
    };
  }
}
