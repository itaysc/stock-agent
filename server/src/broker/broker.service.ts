import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AlpacaService } from '../alpaca/alpaca.service.js';
import { BacktestService } from '../backtest/backtest.service.js';
import { completedBefore } from '../paper/market-clock.js';
import { WalkForwardService } from '../backtest/walkforward/walkforward.service.js';
import { NotifierService } from '../notify/notifier.service.js';
import { DeploymentsService } from '../paper/deployments.service.js';
import type { Deployment } from '../paper/deployment.types.js';
import { DEFAULT_NEWS_CHECK } from '../paper/deployment.types.js';
import { holdingHistory, stockChart } from './broker-charts.js';
import { previewPlan } from './broker-preview.js';
import { dailyReport } from './broker-report.js';
import { BrokerStore } from './broker-store.js';
import { healthCheck } from './broker-health.js';
import { brokerView } from './broker-view.js';
import { BROKER_STOCKS, DEFAULT_PARAMS, SAFE_ASSET } from './universe.js';

const DAY_MS = 86_400_000;
const CHECK_EVERY_DAYS = 30;

/**
 * The broker: one paper deployment that runs the momentum rotation on the
 * biggest US stocks by itself. It reports every trading day, checks monthly
 * that the algo still works, and checks the news before each buy.
 */
@Injectable()
export class BrokerService {
  private readonly logger = new Logger(BrokerService.name);

  constructor(
    private readonly store: BrokerStore,
    private readonly deployments: DeploymentsService,
    private readonly backtests: BacktestService,
    private readonly walkForwards: WalkForwardService,
    private readonly notifier: NotifierService,
    private readonly alpaca: AlpacaService,
  ) {}

  /** Its deployment, unless it was never started or was stopped. */
  async deployment(): Promise<Deployment | null> {
    const { deploymentId } = await this.store.get();
    if (!deploymentId) return null;
    const d = await this.deployments.get(deploymentId).catch(() => null);
    return d && d.status !== 'stopped' ? d : null;
  }

  async view() {
    const [state, d] = await Promise.all([this.store.get(), this.deployment()]);
    if (!d) return brokerView(null, state, null);
    const [spy, history] = await Promise.all([
      this.spySince(d.createdAt),
      holdingHistory(this.backtests, d).catch(() => ({})),
    ]);
    return brokerView(d, state, spy, history);
  }

  /** What it would buy now with this much (before you approve), from completed days only. */
  async preview(capital: number) {
    return previewPlan(
      this.backtests,
      capital,
      completedBefore(await this.alpaca.getClock()),
    );
  }

  /** One stock's price chart with its trades and sell levels. */
  async chart(symbol: string) {
    return stockChart(
      this.backtests,
      await this.deployment(),
      symbol.toUpperCase(),
    );
  }

  async start(capital: number) {
    if (await this.deployment())
      throw new BadRequestException('The broker is already running');
    const state = await this.store.get();
    const d = await this.deployments.create({
      name: 'Broker',
      sleeves: [
        {
          strategy: 'momentum-rotation',
          symbols: [...BROKER_STOCKS, SAFE_ASSET],
          params: DEFAULT_PARAMS,
          weightPct: 100,
        },
      ],
      capital,
      source: { kind: 'broker' },
      // Acting on its own: severe breaking news (AI-confirmed) on a holding sells it.
      newsCheck: { ...DEFAULT_NEWS_CHECK, watch: 'sell' },
    });
    const now = new Date();
    await this.store.save({
      ...state,
      deploymentId: d.id,
      lastReportAt: now,
      lastReportedBarAt: d.lastBarAt,
      lastTune: state.lastTune ?? {
        at: now,
        message: 'Started with the classic 12-1 momentum settings.',
      },
    });
    await this.notifier.send(
      `🤖 Broker started with $${capital.toLocaleString('en-US')} of paper money. It picks from ${BROKER_STOCKS.length} big US stocks, trades after each close and reports here every trading day.`,
    );
    return this.view();
  }

  async pause() {
    const d = await this.required();
    await this.deployments.pause(d.id);
    return this.view();
  }

  async resume() {
    const d = await this.required();
    await this.deployments.resume(d.id);
    return this.view();
  }

  /** Sells everything; start again any time. */
  async stop() {
    const d = await this.required();
    await this.deployments.stop(
      d.id,
      'Broker stopped by you: everything is being sold',
    );
    return this.view();
  }

  /** The daily report, when a new trading day was processed (called by the scheduler). */
  async reportIfNew(force = false): Promise<string | null> {
    const [state, d] = await Promise.all([this.store.get(), this.deployment()]);
    if (!d) return null;
    const day = d.lastBarAt ? new Date(d.lastBarAt).getTime() : 0;
    const last = state.lastReportedBarAt
      ? new Date(state.lastReportedBarAt).getTime()
      : 0;
    if (!force && day <= last) return null;
    const v = brokerView(d, state, await this.spySince(d.createdAt));
    if (v.status === 'off') return null;
    const text = dailyReport(
      v,
      state.lastReportAt ? new Date(state.lastReportAt) : null,
    );
    await this.notifier.send(text);
    await this.store.save({
      ...state,
      lastReportAt: new Date(),
      lastReportedBarAt: d.lastBarAt,
    });
    return text;
  }

  /** The monthly health check (called by the scheduler); never changes the settings. */
  async checkIfDue(now = new Date()): Promise<void> {
    const [state, d] = await Promise.all([this.store.get(), this.deployment()]);
    if (!d) return;
    const last = state.lastTune ? new Date(state.lastTune.at).getTime() : 0;
    if (now.getTime() - last < CHECK_EVERY_DAYS * DAY_MS) return;
    const r = await healthCheck(
      this.walkForwards,
      d.sleeves[0].params,
      d.capital,
      now,
    );
    await this.store.save({
      ...state,
      lastTune: { at: now, message: r.message },
    });
    await this.notifier.send(r.message);
  }

  private async required(): Promise<Deployment> {
    const d = await this.deployment();
    if (!d) throw new BadRequestException('The broker is not running');
    return d;
  }

  /** SPY's return since a date (to compare with), or null without data. */
  private async spySince(from: Date): Promise<number | null> {
    try {
      const bars =
        (
          await this.backtests.fetchBars(['SPY'], {
            timeframe: '1Day',
            from: new Date(new Date(from).getTime() - 4 * DAY_MS),
            to: new Date(),
          })
        )['SPY'] ?? [];
      const start =
        bars.filter((b) => b.timestamp <= new Date(from)).at(-1) ?? bars[0];
      const end = bars.at(-1);
      return start && end ? (end.close / start.close - 1) * 100 : null;
    } catch (err) {
      this.logger.warn(`SPY comparison failed: ${(err as Error).message}`);
      return null;
    }
  }
}
