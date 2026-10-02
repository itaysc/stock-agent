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

  /** A message for each new fill (bought / sold, price, why, stop or result), per investment. */
  async notifyFills(): Promise<void> {
    const [state, list] = await Promise.all([
      this.store.get(),
      this.broker.investments(),
    ]);
    const notified = { ...state.notified };
    const messages: string[] = [];
    for (const d of list) {
      // Every part's trades, oldest first (new fills are the latest).
      const trades = d.ledgers
        .flatMap((l, i) =>
          l.trades.map((t) => ({
            t,
            stop: Number(d.sleeves[i].params.stopPct ?? 0),
          })),
        )
        .sort(
          (a, b) =>
            new Date(a.t.timestamp).getTime() -
            new Date(b.t.timestamp).getTime(),
        );
      // Older state (one investment): its count; unknown: start from now.
      const done =
        notified[d.id] ??
        (d.id === state.deploymentId ? state.notifiedTrades : undefined) ??
        trades.length;
      const label = list.length > 1 ? `${d.name}: ` : '';
      for (const { t, stop } of trades.slice(done))
        messages.push(label + fillMessage(t, stop));
      notified[d.id] = trades.length;
    }
    if (messages.length) await this.notifier.send(messages.join('\n\n'));
    if (JSON.stringify(notified) !== JSON.stringify(state.notified))
      await this.store.save({ ...state, notified });
  }

  /** The daily update (every investment), when a new trading day was processed (or now, with force). */
  async reportIfNew(force = false): Promise<string | null> {
    const [state, list] = await Promise.all([
      this.store.get(),
      this.broker.investments(),
    ]);
    if (!list.length) return null;
    const day = Math.max(
      ...list.map((d) => (d.lastBarAt ? new Date(d.lastBarAt).getTime() : 0)),
    );
    const last = state.lastReportedBarAt
      ? new Date(state.lastReportedBarAt).getTime()
      : 0;
    if (!force && day <= last) return null;
    const since = state.lastReportAt ? new Date(state.lastReportAt) : null;
    const parts = [];
    for (const d of list) {
      const v = await this.broker.fullView(d, state);
      parts.push(
        (list.length > 1 ? `━━ ${d.name} ━━\n` : '') + dailyReport(v, since),
      );
    }
    const text = parts.join('\n\n');
    await this.notifier.send(text);
    await this.store.save({
      ...state,
      lastReportAt: new Date(),
      lastReportedBarAt: new Date(day),
    });
    return text;
  }

  /** The monthly health check; never changes the settings. */
  async checkIfDue(now = new Date()): Promise<void> {
    const [state, list] = await Promise.all([
      this.store.get(),
      this.broker.investments(),
    ]);
    const d = list[0];
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
