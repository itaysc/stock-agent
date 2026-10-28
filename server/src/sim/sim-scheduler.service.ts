import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { applySplit, cents } from './sim-fills.js';
import { activityId, SimLedger } from './sim-ledger.service.js';
import { SimMarket } from './sim-market.service.js';

const EVERY_MS = 60_000;
const DAY_MS = 86_400_000;
/** New York's date (the trading day). */
const nyDay = (at: Date) =>
  at.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const nyHour = (at: Date) =>
  Number(
    at.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hourCycle: 'h23',
    }),
  );

/**
 * Every minute (with the paper runner on): while the market is open, fills
 * the paper accounts' waiting orders; once it closes, keeps each account's
 * value for tomorrow's change and applies splits and dividends.
 */
@Injectable()
export class SimScheduler
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(SimScheduler.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly ledger: SimLedger,
    private readonly market: SimMarket,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.get('PAPER_TRADING_ENABLED', { infer: true })) return;
    this.timer = setInterval(() => void this.tick(), EVERY_MS);
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  async tick(now = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      if (!(await this.ledger.accounts.exists({}))) return;
      if (await this.market.isOpen()) await this.fillWaiting();
      // After the close (not before the open): today's value is final.
      else if (nyHour(now) >= 16) await this.closeDay(nyDay(now));
    } catch (err) {
      this.logger.error(`Paper accounts: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /** Every waiting order, at the latest price (one price request for all of them). */
  async fillWaiting(): Promise<number> {
    const waiting = await this.ledger.orders
      .find({ status: 'accepted' })
      .sort({ submittedAt: 1 })
      .lean();
    if (!waiting.length) return 0;
    const quotes = await this.market.quotes(waiting.map((o) => o.symbol));
    for (const order of waiting) {
      const price = quotes.get(order.symbol)?.price;
      if (price) await this.ledger.fill(order, price);
    }
    return waiting.length;
  }

  /**
   * After the close, once a day: splits and dividends, then each account's
   * value (yesterday's value for the next day's change).
   */
  async closeDay(day: string): Promise<void> {
    const due = await this.ledger.accounts
      .find({ lastEquityDay: { $ne: day } })
      .lean();
    if (!due.length) return;
    const symbols = [
      ...new Set(due.flatMap((a) => a.positions.map((p) => p.symbol))),
    ];
    const actions = await this.market.corporateActions(
      symbols,
      new Date(Date.now() - 30 * DAY_MS),
    );
    const quotes = await this.market.quotes(symbols);
    for (const doc of due) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const a = await this.ledger.account(doc._id);
        let positions = a.positions;
        let cash = a.cash;
        const applied: string[] = [];
        const dividends: Array<{ symbol: string; qty: number; rate: number }> =
          [];
        const holds = (s: string) => positions.find((p) => p.symbol === s);
        const fresh = <T extends { id: string; symbol: string; exDate: Date }>(
          list: T[] | undefined,
        ) =>
          (list ?? []).filter(
            (x) =>
              nyDay(new Date(x.exDate)) <= day &&
              !a.appliedActions.includes(x.id) &&
              holds(x.symbol),
          );
        for (const s of [
          ...fresh(actions.forwardSplits),
          ...fresh(actions.reverseSplits),
        ]) {
          positions = applySplit(positions, s.symbol, s.oldRate, s.newRate);
          applied.push(s.id);
        }
        for (const d of fresh(actions.cashDividends)) {
          const qty = holds(d.symbol)!.qty;
          cash = cents(cash + qty * d.rate);
          dividends.push({ symbol: d.symbol, qty, rate: d.rate });
          applied.push(d.id);
        }
        const equity = cents(
          cash +
            positions.reduce(
              (s, p) => s + p.qty * (quotes.get(p.symbol)?.price ?? 0),
              0,
            ),
        );
        const r = await this.ledger.accounts.updateOne(
          { _id: a._id, rev: a.rev },
          {
            $set: { cash, positions, lastEquity: equity, lastEquityDay: day },
            $push: { appliedActions: { $each: applied } },
            $inc: { rev: 1 },
          },
        );
        if (!r.modifiedCount) continue;
        const at = new Date();
        for (const d of dividends)
          await this.ledger.activities.create({
            _id: activityId(at),
            accountId: a._id,
            at,
            row: {
              activity_type: 'DIV',
              date: day,
              net_amount: String(cents(d.qty * d.rate)),
              symbol: d.symbol,
              qty: String(d.qty),
              per_share_amount: String(d.rate),
            },
          });
        break;
      }
    }
  }
}
