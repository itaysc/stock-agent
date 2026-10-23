import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { AlpacaService } from '../alpaca/alpaca.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { DeploymentsService } from '../paper/deployments.service.js';
import type { ManualLevels } from '../paper/deployment.types.js';
import { AssetsService } from './assets.service.js';
import { type MyStocks, MyStocksStore } from './my-stocks.store.js';
import {
  buySize,
  type OrderSize,
  plainOrderError,
  sellQty,
} from './trade-sizing.js';

const usd = (n: number) => `$${n.toFixed(2)}`;

/** Buying and selling your own stocks (the Trade page), on the paper account only. */
@Injectable()
export class MyStocksService {
  constructor(
    private readonly store: MyStocksStore,
    private readonly alpaca: AlpacaService,
    private readonly orders: OrdersService,
    private readonly assets: AssetsService,
    private readonly deployments: DeploymentsService,
  ) {}

  private paperOnly(): void {
    if (!this.alpaca.isPaper)
      throw new BadRequestException(
        'The Trade page works on the paper account only for now',
      );
  }

  private async priceOf(symbol: string): Promise<number> {
    const p = (await this.alpaca.getLatestTrades([symbol]))[symbol]?.price;
    if (!p) throw new BadRequestException(`No current price for ${symbol}`);
    return p;
  }

  /** Buys about `amount` dollars of a stock at market (now, or at the next open). */
  async buy(symbol: string, amount: number): Promise<MyStocks> {
    this.paperOnly();
    const asset = await this.assets.find(symbol);
    if (!asset)
      throw new BadRequestException(`${symbol} can't be traded on Alpaca`);
    const free = await this.deployments.freeCash();
    if (amount > free)
      throw new BadRequestException(
        `Only ${usd(Math.max(0, free))} is free to invest (the rest belongs to your investments)`,
      );
    const price = await this.priceOf(asset.symbol);
    let size: OrderSize;
    try {
      size = buySize(amount, price, asset.fractionable);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    return this.send(asset.symbol, 'buy', size, price);
  }

  /** Sells about `amount` dollars of your shares (all of them without an amount). */
  async sell(symbol: string, amount?: number): Promise<MyStocks> {
    this.paperOnly();
    const m = await this.store.get();
    const s = symbol.toUpperCase();
    if (m.ledger.pending.some((p) => p.symbol === s && p.side === 'sell'))
      throw new BadRequestException(`A sell of ${s} is already waiting`);
    const asset = await this.assets.find(s);
    const price = await this.priceOf(s);
    let qty: number;
    try {
      qty = sellQty(
        m.ledger.positions[s]?.qty ?? 0,
        price,
        asset?.fractionable ?? true,
        amount,
      );
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    return this.send(s, 'sell', { qty }, price);
  }

  /** Sends the market order (through the risk checks) and keeps it as pending until it fills. */
  private async send(
    symbol: string,
    side: 'buy' | 'sell',
    size: OrderSize,
    price: number,
    reason = 'you',
  ): Promise<MyStocks> {
    const clientOrderId = `man-${symbol}-${randomUUID().slice(0, 8)}`;
    try {
      await this.orders.placeOrder({
        clientOrderId,
        symbol,
        side,
        type: 'market',
        timeInForce: 'day',
        ...size,
      });
    } catch (err) {
      throw new BadRequestException(plainOrderError(err));
    }
    const notional = 'notional' in size ? size.notional : undefined;
    return this.store.update((m) => {
      m.ledger.pending.push({
        clientOrderId,
        symbol,
        side,
        qty: 'qty' in size ? size.qty : (notional as number) / price,
        reason,
        submittedAt: new Date(),
        bookedQty: 0,
        ...(notional === undefined ? {} : { notional }),
      });
      m.ledger.lastPrices[symbol] = price;
      const what =
        notional === undefined
          ? `${'qty' in size ? size.qty : ''} ${symbol}`
          : `${usd(notional)} of ${symbol}`;
      m.events.push({
        timestamp: new Date(),
        message: `Sent ${side} ${what} (${reason}): fills now, or at the next open when the market is closed`,
      });
      return m;
    });
  }

  /** Sells all of a stock because one of your levels was hit (from the daily check). */
  sellAllFor(symbol: string, qty: number, price: number, why: string) {
    return this.send(symbol, 'sell', { qty }, price, why);
  }

  setLevels(symbol: string, levels: ManualLevels): Promise<MyStocks> {
    const s = symbol.toUpperCase();
    return this.store.update((m) => {
      if (!m.ledger.positions[s])
        throw new BadRequestException(`You don't hold ${s} on the Trade page`);
      if (levels.stopPrice == null && levels.takeProfitPrice == null)
        delete m.levels[s];
      else m.levels[s] = levels;
      return m;
    });
  }

  setWatchlist(symbols: string[]): Promise<MyStocks> {
    return this.store.update((m) => {
      m.watchlist = [...new Set(symbols.map((s) => s.toUpperCase()))].slice(
        0,
        50,
      );
      return m;
    });
  }
}
