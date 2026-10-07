import { BadRequestException, Injectable } from '@nestjs/common';
import { AlpacaService } from '../alpaca/alpaca.service.js';
import { BacktestService } from '../backtest/backtest.service.js';
import { NotifierService } from '../notify/notifier.service.js';
import { DeploymentStore } from '../paper/deployment-store.js';
import type { Deployment, ManualLevels } from '../paper/deployment.types.js';
import { DEFAULT_NEWS_CHECK } from '../paper/deployment.types.js';
import { DeploymentsService } from '../paper/deployments.service.js';
import { completedBefore } from '../paper/market-clock.js';
import { PositionActionsService } from '../paper/position-actions.service.js';
import { holdingHistory, spySince, stockChart } from './broker-charts.js';
import { trackingOf } from './broker-tracking.js';
import { currentRanks, previewPlan } from './broker-preview.js';
import { pickProfile, profilesFor } from './broker-profiles.js';
import type { Ranks } from './broker-status.js';
import { BrokerStore } from './broker-store.js';
import type { BrokerState } from './broker.types.js';
import { brokerView } from './broker-view.js';
import { INDEX_SYMBOLS } from './profiles.js';
import { BROKER_STOCKS, SAFE_ASSET } from './universe.js';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * The broker: your investments, each a paper deployment with its own amount
 * and risk profile, run by the momentum rotation on the biggest US stocks.
 * It reports every trading day, checks monthly that the algo still works,
 * and checks the news before each buy.
 */
@Injectable()
export class BrokerService {
  constructor(
    private readonly store: BrokerStore,
    private readonly deployments: DeploymentsService,
    private readonly deploymentStore: DeploymentStore,
    private readonly backtests: BacktestService,
    private readonly notifier: NotifierService,
    private readonly alpaca: AlpacaService,
    private readonly positions: PositionActionsService,
  ) {}

  /** The running investments (not stopped), oldest first. */
  async investments(): Promise<Deployment[]> {
    return (await this.deploymentStore.live())
      .filter((d) => d.source.kind === 'broker')
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  }

  /** One running investment. */
  async investment(id: string): Promise<Deployment> {
    const d = (await this.investments()).find((x) => x.id === id);
    if (!d) throw new BadRequestException(`No running investment ${id}`);
    return d;
  }

  /** Every investment, and what the page shows when there is none. */
  async view() {
    const [state, list] = await Promise.all([
      this.store.get(),
      this.investments(),
    ]);
    const ranks = list.length ? await this.ranks() : null;
    return {
      investments: await Promise.all(
        list.map((d) => this.fullView(d, state, ranks)),
      ),
      ...brokerView(null, state, null),
    };
  }

  /** One investment with everything it needs: vs SPY, the stop levels, each stock's rank now. */
  async fullView(d: Deployment, state: BrokerState, ranks?: Ranks | null) {
    const [spy, history, r] = await Promise.all([
      spySince(this.backtests, d.createdAt).catch(() => null),
      holdingHistory(this.backtests, d).catch(() => ({})),
      ranks === undefined ? this.ranks() : ranks,
    ]);
    const v = brokerView(d, state, spy, history, r);
    if (v.status === 'off') throw new Error('Unexpected: no investment');
    return v;
  }

  private ranks(): Promise<Ranks | null> {
    return this.alpaca
      .getClock()
      .then((clock) => currentRanks(this.backtests, completedBefore(clock)))
      .catch(() => null);
  }

  /** What it would buy now with this much and this profile (before you approve), from completed days only. */
  async preview(capital: number, profileId?: string) {
    return previewPlan(
      this.backtests,
      capital,
      completedBefore(await this.alpaca.getClock()),
      pickProfile(capital, profileId),
    );
  }

  /** Every profile with its history (also in dollars for this amount), and the one suggested for it. */
  profiles(capital: number) {
    return profilesFor(capital);
  }

  /** A new investment of `capital` with this profile (another one can run next to it). */
  async start(capital: number, profileId?: string) {
    const free = await this.deployments.freeCash();
    if (capital > free)
      throw new BadRequestException(`Only ${money(free)} is free to invest`);
    const state = await this.store.get();
    const profile = pickProfile(capital, profileId);
    const d = await this.deployments.create({
      name: `${profile.name} · ${money(capital)}`,
      sleeves: profile.sleeves.map((s) => ({
        strategy: 'momentum-rotation',
        symbols:
          s.kind === 'index' ? INDEX_SYMBOLS : [...BROKER_STOCKS, SAFE_ASSET],
        params: s.params,
        weightPct: s.weightPct,
      })),
      capital,
      // No automatic sell-everything: it asks you in Telegram past this drop.
      drawdownAlertPct: profile.alertPct,
      source: { kind: 'broker', profile: profile.id },
      // Acting on its own: severe breaking news (AI-confirmed) on a holding sells it.
      newsCheck: { ...DEFAULT_NEWS_CHECK, watch: 'sell' },
      // 51 stocks × 3 years of headlines is thousands of requests: backtest without the news part.
      backtestNews: false,
    });
    const now = new Date();
    await this.store.save({
      ...state,
      params: profile.sleeves[0].params,
      notified: { ...state.notified, [d.id]: 0 },
      lastReportAt: state.lastReportAt ?? now,
      lastTune: state.lastTune ?? {
        at: now,
        message: 'Started with the classic 12-1 momentum settings.',
      },
    });
    await this.notifier.send(
      `🤖 New investment: ${money(capital)} of paper money, ${profile.name}. ${profile.summary} It trades after each close and reports here every trading day.`,
    );
    return this.view();
  }

  async pause(id: string) {
    await this.deployments.pause((await this.investment(id)).id);
    return this.view();
  }

  async resume(id: string) {
    await this.deployments.resume((await this.investment(id)).id);
    return this.view();
  }

  /** Sells everything of one investment and stops it. */
  async stop(id: string) {
    await this.deployments.stop(
      (await this.investment(id)).id,
      'Stopped by you: everything is being sold',
    );
    return this.view();
  }

  /** Pause or resume every investment (Telegram /pause, /resume). Returns how many changed. */
  async setAll(status: 'paused' | 'active'): Promise<number> {
    let n = 0;
    for (const d of await this.investments())
      if (status === 'paused' && d.status === 'active')
        n += +!!(await this.deployments.pause(d.id));
      else if (status === 'active' && d.status === 'paused')
        n += +!!(await this.deployments.resume(d.id));
    return n;
  }

  /** Sells all (fraction 1) or part of one holding now. */
  async sell(id: string, symbol: string, fraction: number) {
    await this.positions.sell((await this.investment(id)).id, symbol, fraction);
    return this.view();
  }

  /** Your own stop loss / profit target for one holding (null clears it). */
  async setLevels(id: string, symbol: string, levels: ManualLevels) {
    await this.positions.setLevels(
      (await this.investment(id)).id,
      symbol,
      levels,
    );
    return this.view();
  }

  /** Lets it buy a stock you sold again. */
  async allow(id: string, symbol: string) {
    await this.positions.allow((await this.investment(id)).id, symbol);
    return this.view();
  }

  /** The investment's live days next to the same setup backtested over the same days. */
  async tracking(id: string) {
    return trackingOf(this.backtests, await this.investment(id));
  }

  /** One stock's price chart with its trades and sell levels, in one investment. */
  async chart(id: string, symbol: string) {
    return stockChart(
      this.backtests,
      await this.investment(id),
      symbol.toUpperCase(),
    );
  }
}
