import { BadRequestException, Injectable } from '@nestjs/common';
import { AlpacaService } from '../alpaca/alpaca.service.js';
import { BacktestService } from '../backtest/backtest.service.js';
import { completedBefore } from '../paper/market-clock.js';
import { NotifierService } from '../notify/notifier.service.js';
import { DeploymentsService } from '../paper/deployments.service.js';
import type { Deployment } from '../paper/deployment.types.js';
import { DEFAULT_NEWS_CHECK } from '../paper/deployment.types.js';
import { holdingHistory, spySince, stockChart } from './broker-charts.js';
import { currentRanks, previewPlan } from './broker-preview.js';
import type { ManualLevels } from '../paper/deployment.types.js';
import { PositionActionsService } from '../paper/position-actions.service.js';
import { BrokerStore } from './broker-store.js';
import type { BrokerState } from './broker.types.js';
import { brokerView } from './broker-view.js';
import { BROKER_STOCKS, DEFAULT_PARAMS, SAFE_ASSET } from './universe.js';

/**
 * The broker: one paper deployment that runs the momentum rotation on the
 * biggest US stocks by itself. It reports every trading day, checks monthly
 * that the algo still works, and checks the news before each buy.
 */
@Injectable()
export class BrokerService {
  constructor(
    private readonly store: BrokerStore,
    private readonly deployments: DeploymentsService,
    private readonly backtests: BacktestService,
    private readonly notifier: NotifierService,
    private readonly alpaca: AlpacaService,
    private readonly positions: PositionActionsService,
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
    return d ? this.fullView(d, state) : brokerView(null, state, null);
  }

  /** The view with everything it needs: vs SPY, the stop levels, each stock's rank now. */
  async fullView(d: Deployment, state: BrokerState) {
    const [spy, history, ranks] = await Promise.all([
      spySince(this.backtests, d.createdAt).catch(() => null),
      holdingHistory(this.backtests, d).catch(() => ({})),
      this.alpaca
        .getClock()
        .then((clock) => currentRanks(this.backtests, completedBefore(clock)))
        .catch(() => null),
    ]);
    return brokerView(d, state, spy, history, ranks);
  }

  /** What it would buy now with this much (before you approve), from completed days only. */
  async preview(capital: number) {
    return previewPlan(
      this.backtests,
      capital,
      completedBefore(await this.alpaca.getClock()),
    );
  }

  /** Sells all (fraction 1) or part of one holding now. */
  async sell(symbol: string, fraction: number) {
    await this.positions.sell((await this.required()).id, symbol, fraction);
    return this.view();
  }

  /** Your own stop loss / profit target for one holding (null clears it). */
  async setLevels(symbol: string, levels: ManualLevels) {
    await this.positions.setLevels((await this.required()).id, symbol, levels);
    return this.view();
  }

  /** Lets it buy a stock you sold again. */
  async allow(symbol: string) {
    await this.positions.allow((await this.required()).id, symbol);
    return this.view();
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
      // 51 stocks × 3 years of headlines is thousands of requests: backtest without the news part.
      backtestNews: false,
    });
    const now = new Date();
    await this.store.save({
      ...state,
      deploymentId: d.id,
      lastReportAt: now,
      lastReportedBarAt: d.lastBarAt,
      notifiedTrades: 0,
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

  private async required(): Promise<Deployment> {
    const d = await this.deployment();
    if (!d) throw new BadRequestException('The broker is not running');
    return d;
  }
}
