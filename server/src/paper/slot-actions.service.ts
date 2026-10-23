import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotifierService } from '../notify/notifier.service.js';
import { roundQty } from '../strategies/qty.js';
import { logEvent } from './deployment-events.js';
import { checksNews } from './deployment-orders.js';
import { DeploymentRunnerService } from './deployment-runner.service.js';
import { DeploymentStore } from './deployment-store.js';
import type { Deployment } from './deployment.types.js';
import { mayBuy } from './manual-exits.js';
import { PositionActionsService } from './position-actions.service.js';
import { ledgerEquity } from './sleeve-ledger.js';
import { soldByYou } from './your-picks.js';

const usd = (n: number) => `$${n.toFixed(2)}`;

/**
 * Selling one stock of an investment and what happens to its place: another
 * stock you pick takes it now (the next in line, usually), or it stays empty
 * (in T-bills) while the others keep running, until you pick one.
 */
@Injectable()
export class SlotActionsService {
  constructor(
    private readonly store: DeploymentStore,
    private readonly runner: DeploymentRunnerService,
    private readonly positions: PositionActionsService,
    private readonly notifier: NotifierService,
  ) {}

  /** Sells all of `symbol`; then buys `replaceWith` for about the same money, or leaves the slot empty. */
  async sellOne(
    id: string,
    symbol: string,
    replaceWith?: string,
  ): Promise<Deployment> {
    const before = await this.load(id);
    const s = symbol.toUpperCase();
    const sleeve = before.ledgers.findIndex((l) => l.positions[s]);
    if (sleeve < 0) throw new NotFoundException(`It does not hold ${s}`);
    const l = before.ledgers[sleeve];
    const value =
      l.positions[s].qty * (l.lastPrices[s] ?? l.positions[s].avgPrice);
    if (replaceWith) this.check(before, sleeve, replaceWith.toUpperCase());
    await this.positions.sell(id, s, 1);
    const d = await this.load(id);
    const now = new Date();
    if (replaceWith) {
      await this.buy(
        d,
        sleeve,
        replaceWith.toUpperCase(),
        value,
        `replaces ${s} (you chose it)`,
      );
    } else {
      d.ledgers[sleeve].emptySlots = (d.ledgers[sleeve].emptySlots ?? 0) + 1;
      logEvent(
        d,
        `You sold ${s} and left its place empty: the other stocks keep running, its money waits in T-bills until you pick a stock for it`,
        now,
      );
      await this.notifier.send(
        `${d.name}: you sold ${s}. Its place is empty (the money waits in T-bills): open the broker page to pick the next in line, so all ${d.sleeves[sleeve].params.topN ?? 5} places work again.`,
      );
    }
    await this.store.save(d);
    return d;
  }

  /** Fills an empty slot with `symbol` (an equal share of that part of the investment). */
  async fillSlot(id: string, symbol: string): Promise<Deployment> {
    const d = await this.load(id);
    const s = symbol.toUpperCase();
    const sleeve = d.ledgers.findIndex(
      (l, i) => (l.emptySlots ?? 0) > 0 && d.sleeves[i].symbols.includes(s),
    );
    if (sleeve < 0)
      throw new BadRequestException(
        `No empty place for ${s} in this investment`,
      );
    this.check(d, sleeve, s);
    const l = d.ledgers[sleeve];
    const topN = Number(d.sleeves[sleeve].params.topN ?? 5) || 5;
    await this.buy(
      d,
      sleeve,
      s,
      ledgerEquity(l) / topN,
      'fills the place you left empty',
    );
    l.emptySlots = Math.max(0, (l.emptySlots ?? 0) - 1);
    await this.store.save(d);
    return d;
  }

  /** A stock this part of the investment may buy now. */
  private check(d: Deployment, sleeve: number, s: string): void {
    const l = d.ledgers[sleeve];
    const now = new Date();
    if (!d.sleeves[sleeve].symbols.includes(s))
      throw new BadRequestException(
        `${s} is not one of this investment's stocks`,
      );
    if (l.positions[s]) throw new BadRequestException(`It already holds ${s}`);
    if (
      l.pending.some((o) => o.symbol === s) ||
      l.staged?.some((b) => b.symbol === s)
    )
      throw new BadRequestException(`An order for ${s} is already waiting`);
    if (!mayBuy(d, s, now) || soldByYou(d, s, now))
      throw new BadRequestException(
        `You sold ${s} recently: allow it again first`,
      );
  }

  /** Buys about `amount` dollars: after the news check before the open when it has one, else now. */
  private async buy(
    d: Deployment,
    sleeve: number,
    s: string,
    amount: number,
    reason: string,
  ): Promise<void> {
    const l = d.ledgers[sleeve];
    const price = l.lastPrices[s];
    if (!price) throw new BadRequestException(`No price for ${s} yet`);
    const fractional = !!Number(d.sleeves[sleeve].params.fractional ?? 0);
    const qty = roundQty(amount / price, fractional);
    if (!(qty > 0))
      throw new BadRequestException(`${usd(amount)} buys no share of ${s}`);
    if (checksNews(d)) {
      (l.staged ??= []).push({ symbol: s, qty, reason, signalAt: new Date() });
      logEvent(
        d,
        `Buy ${usd(amount)} of ${s} (${reason}): waiting for the news check before the open`,
        new Date(),
      );
    } else
      await this.runner.placeNow(
        d,
        sleeve,
        { symbol: s, side: 'buy', qty, reason },
        'you chose it',
      );
  }

  private async load(id: string): Promise<Deployment> {
    const d = await this.store.get(id);
    if (!d) throw new NotFoundException(`No deployment ${id}`);
    if (d.status === 'stopped') throw new BadRequestException('It is stopped');
    return d;
  }
}
