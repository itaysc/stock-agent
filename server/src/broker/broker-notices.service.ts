import { Injectable } from '@nestjs/common';
import { WalkForwardService } from '../backtest/walkforward/walkforward.service.js';
import { NotifierService } from '../notify/notifier.service.js';
import { healthCheck } from './broker-health.js';
import { dailyReport, fillMessage } from './broker-report.js';
import { BrokerStore } from './broker-store.js';
import { BrokerService } from './broker.service.js';

const DAY_MS = 86_400_000;
const CHECK_EVERY_DAYS = 30;

/** What the broker tells you in Telegram: each fill, a daily update, the monthly check. */
@Injectable()
export class BrokerNoticesService {
  constructor(
    private readonly broker: BrokerService,
    private readonly store: BrokerStore,
    private readonly walkForwards: WalkForwardService,
    private readonly notifier: NotifierService,
  ) {}

  /** A message for each new fill (bought / sold, price, why, stop or result). */
  async notifyFills(): Promise<void> {
    const [state, d] = await Promise.all([
      this.store.get(),
      this.broker.deployment(),
    ]);
    if (!d) return;
    const trades = d.ledgers[0].trades;
    const done = state.notifiedTrades ?? trades.length; // older state: start from now
    if (trades.length <= done) {
      if (state.notifiedTrades === undefined)
        await this.store.save({ ...state, notifiedTrades: done });
      return;
    }
    const stop = Number(d.sleeves[0].params.stopPct ?? 0);
    await this.notifier.send(
      trades
        .slice(done)
        .map((t) => fillMessage(t, stop))
        .join('\n\n'),
    );
    await this.store.save({ ...state, notifiedTrades: trades.length });
  }

  /** The daily update, when a new trading day was processed (or now, with force). */
  async reportIfNew(force = false): Promise<string | null> {
    const [state, d] = await Promise.all([
      this.store.get(),
      this.broker.deployment(),
    ]);
    if (!d) return null;
    const day = d.lastBarAt ? new Date(d.lastBarAt).getTime() : 0;
    const last = state.lastReportedBarAt
      ? new Date(state.lastReportedBarAt).getTime()
      : 0;
    if (!force && day <= last) return null;
    const v = await this.broker.fullView(d, state);
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

  /** The monthly health check; never changes the settings. */
  async checkIfDue(now = new Date()): Promise<void> {
    const [state, d] = await Promise.all([
      this.store.get(),
      this.broker.deployment(),
    ]);
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
}
