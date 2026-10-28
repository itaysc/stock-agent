import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import {
  applyFill,
  checkOrder,
  fillQty,
  type OrderRequest,
  SimError,
} from './sim-fills.js';
import { SimMarket } from './sim-market.service.js';
import {
  SimAccountDoc,
  SimActivityDoc,
  SimOrderDoc,
  type SimPosition,
} from './sim.schema.js';

/** Activity ids sort by time (as Alpaca's do), so paging by the last id works. */
export const activityId = (at: Date) =>
  `${at.toISOString().replace(/\D/g, '')}::${randomUUID()}`;

/**
 * The books of the Bullwether paper accounts: cash, stocks, orders and
 * fills. Orders fill at the latest trade price while the market is open, and
 * wait for the next open otherwise.
 */
@Injectable()
export class SimLedger {
  constructor(
    private readonly market: SimMarket,
    @InjectModel(SimAccountDoc.name)
    readonly accounts: Model<SimAccountDoc>,
    @InjectModel(SimOrderDoc.name) readonly orders: Model<SimOrderDoc>,
    @InjectModel(SimActivityDoc.name)
    readonly activities: Model<SimActivityDoc>,
  ) {}

  async create(id: string, owner: string, cash: number): Promise<void> {
    await this.accounts.create({
      _id: id,
      owner,
      cash,
      startingCash: cash,
      lastEquity: cash,
    });
  }

  async remove(id: string): Promise<void> {
    await Promise.all([
      this.accounts.deleteOne({ _id: id }),
      this.orders.deleteMany({ accountId: id }),
      this.activities.deleteMany({ accountId: id }),
    ]);
  }

  async account(id: string) {
    const doc = await this.accounts.findById(id).lean();
    if (!doc) throw new SimError('NotFoundError', 404, 'account not found');
    return doc;
  }

  /** The orders still waiting to fill. */
  waiting(id: string) {
    return this.orders.find({ accountId: id, status: 'accepted' }).lean();
  }

  /**
   * Places a market order (the same clientOrderId again: the order already
   * placed). Fills it now while the market is open.
   */
  async submit(
    id: string,
    o: OrderRequest & { clientOrderId?: string },
  ): Promise<SimOrderDoc> {
    const clientOrderId = o.clientOrderId ?? randomUUID();
    const same = await this.orders
      .findOne({ accountId: id, clientOrderId })
      .lean();
    if (same) return same;
    const [account, waiting, asset, price] = await Promise.all([
      this.account(id),
      this.waiting(id),
      this.market.asset(o.symbol),
      this.market.price(o.symbol),
    ]);
    const held = account.positions.find((p) => p.symbol === o.symbol)?.qty ?? 0;
    const selling = waiting
      .filter((w) => w.side === 'sell' && w.symbol === o.symbol)
      .reduce((s, w) => s + (w.qty ?? (w.notional ?? 0) / price), 0);
    const reserved = checkOrder(o, {
      asset,
      price,
      buyingPower: account.cash - waiting.reduce((s, w) => s + w.reserved, 0),
      available: held - selling,
    });
    const order = await this.orders.create({
      _id: randomUUID(),
      accountId: id,
      clientOrderId,
      symbol: o.symbol,
      side: o.side,
      qty: o.qty,
      notional: o.notional,
      timeInForce: o.timeInForce,
      status: 'accepted',
      reserved,
      submittedAt: new Date(),
    });
    if (!(await this.market.isOpen())) return order.toObject();
    return this.fill(order.toObject(), price);
  }

  /** Fills a waiting order at `price`: the shares and cash move, and a FILL activity is kept. */
  async fill(order: SimOrderDoc, price: number): Promise<SimOrderDoc> {
    const now = new Date();
    for (let attempt = 0; attempt < 5; attempt++) {
      const account = await this.account(order.accountId);
      const held = account.positions.find((p) => p.symbol === order.symbol);
      const qty = fillQty(order, price, held?.qty ?? 0);
      const next = applyFill(account.positions, {
        symbol: order.symbol,
        side: order.side,
        qty,
        price,
      });
      const cash = Math.round((account.cash + next.cash) * 100) / 100;
      if (qty <= 0 || cash < 0)
        return this.close(order, 'rejected', {
          reason:
            qty <= 0
              ? 'insufficient qty available for order'
              : 'insufficient buying power at the fill price',
        });
      // Claimed first, so a fill can't happen twice.
      const claimed = await this.orders.updateOne(
        { _id: order._id, status: 'accepted' },
        {
          $set: {
            status: 'filled',
            filledQty: qty,
            filledAvgPrice: price,
            filledAt: now,
            reserved: 0,
          },
        },
      );
      if (!claimed.modifiedCount) return this.order(order._id);
      const moved = await this.move(account, cash, next.positions);
      if (!moved) {
        await this.orders.updateOne(
          { _id: order._id },
          {
            $set: {
              status: 'accepted',
              filledQty: 0,
              reserved: order.reserved,
            },
          },
        );
        continue;
      }
      await this.activities.create({
        _id: activityId(now),
        accountId: order.accountId,
        at: now,
        row: {
          activity_type: 'FILL',
          transaction_time: now.toISOString(),
          type: 'fill',
          price: String(price),
          qty: String(qty),
          cum_qty: String(qty),
          leaves_qty: '0',
          side: order.side,
          symbol: order.symbol,
          order_id: order._id,
          order_status: 'filled',
        },
      });
      return this.order(order._id);
    }
    return this.close(order, 'rejected', { reason: 'the account was busy' });
  }

  /** Cash and positions, if nothing changed them since `read`. */
  async move(
    read: { _id: string; rev: number },
    cash: number,
    positions: SimPosition[],
  ): Promise<boolean> {
    const r = await this.accounts.updateOne(
      { _id: read._id, rev: read.rev },
      { $set: { cash, positions }, $inc: { rev: 1 } },
    );
    return r.modifiedCount === 1;
  }

  /** Cancels a waiting order (Alpaca: 422 once it filled). */
  async cancel(id: string, orderId: string): Promise<void> {
    const order = await this.orders.findOne({ _id: orderId, accountId: id });
    if (!order) throw new SimError('NotFoundError', 404, 'order not found');
    if (order.status !== 'accepted')
      throw new SimError('ValidationError', 422, 'order is not cancelable');
    await this.close(order.toObject(), 'canceled', { canceledAt: new Date() });
  }

  private async close(
    order: SimOrderDoc,
    status: 'canceled' | 'rejected',
    extra: Partial<SimOrderDoc>,
  ): Promise<SimOrderDoc> {
    await this.orders.updateOne(
      { _id: order._id, status: 'accepted' },
      { $set: { status, reserved: 0, ...extra } },
    );
    return this.order(order._id);
  }

  private async order(orderId: string): Promise<SimOrderDoc> {
    const doc = await this.orders.findById(orderId).lean();
    if (!doc) throw new SimError('NotFoundError', 404, 'order not found');
    return doc;
  }
}
