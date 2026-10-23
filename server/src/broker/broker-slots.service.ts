import { Injectable } from '@nestjs/common';
import { AlpacaService } from '../alpaca/alpaca.service.js';
import { BacktestService } from '../backtest/backtest.service.js';
import type { Deployment } from '../paper/deployment.types.js';
import { mayBuy } from '../paper/manual-exits.js';
import { completedBefore } from '../paper/market-clock.js';
import { SlotActionsService } from '../paper/slot-actions.service.js';
import { emptySlots, soldByYou } from '../paper/your-picks.js';
import { rankNow } from './broker-preview.js';
import { BrokerService } from './broker.service.js';
import { SAFE_ASSET } from './universe.js';

/** A stock that could take a free place: its rank among the 50 and its 12-month rise. */
export interface NextInLine {
  symbol: string;
  rank: number;
  momentumPct: number;
  price: number;
}

/** The stocks this investment could buy next (best first): not held, not sold by you, no order waiting. */
export function candidatesFor(
  d: Deployment,
  ranking: string[],
  closes: (symbol: string) => number[],
  now: Date,
  n = 3,
): NextInLine[] {
  const busy = (s: string) =>
    d.ledgers.some(
      (l) =>
        l.positions[s] ||
        l.pending.some((o) => o.symbol === s) ||
        l.staged?.some((b) => b.symbol === s),
    );
  const out: NextInLine[] = [];
  ranking.forEach((s, i) => {
    if (out.length >= n || s === SAFE_ASSET) return;
    if (busy(s) || soldByYou(d, s, now) || !mayBuy(d, s, now)) return;
    const c = closes(s);
    const k = c.length;
    if (k < 274) return;
    out.push({
      symbol: s,
      rank: i + 1,
      momentumPct: (c[k - 22] / c[k - 274] - 1) * 100,
      price: c[k - 1],
    });
  });
  return out;
}

/** Selling one stock of an investment with a choice of what takes its place, and filling an empty place later. */
@Injectable()
export class BrokerSlotsService {
  constructor(
    private readonly broker: BrokerService,
    private readonly slots: SlotActionsService,
    private readonly backtests: BacktestService,
    private readonly alpaca: AlpacaService,
  ) {}

  /** The next in line for this investment (by the broker's momentum ranking on the last close). */
  async nextInLine(id: string) {
    const d = await this.broker.investment(id);
    const { strategy, bars } = await rankNow(
      this.backtests,
      completedBefore(await this.alpaca.getClock()),
    );
    const now = new Date();
    return {
      emptySlots: emptySlots(d),
      candidates: candidatesFor(
        d,
        strategy.ranking(),
        (s) => (bars[s] ?? []).map((b) => b.close),
        now,
      ),
    };
  }

  async sellOne(id: string, symbol: string, replaceWith?: string) {
    await this.slots.sellOne(
      (await this.broker.investment(id)).id,
      symbol,
      replaceWith,
    );
    return this.broker.view();
  }

  async fillSlot(id: string, symbol: string) {
    await this.slots.fillSlot((await this.broker.investment(id)).id, symbol);
    return this.broker.view();
  }
}
