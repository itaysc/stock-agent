import { Injectable, Logger } from '@nestjs/common';
import { AlpacaService } from '../alpaca/alpaca.service.js';
import { DeploymentStore } from '../paper/deployment-store.js';
import type { PendingOrder } from '../paper/deployment.types.js';
import { bookFill } from '../paper/sleeve-ledger.js';
import { TaxSyncService } from '../tax/tax-sync.service.js';
import {
  type AccountHolding,
  boughtSince,
  type SyncChange,
  syncChanges,
} from './alpaca-sync.js';
import { MyStocksRunner } from './my-stocks-runner.service.js';
import { MyStocksStore } from './my-stocks.store.js';

const YEAR_MS = 365 * 86_400_000;
const num = (v: unknown) => Number(v ?? 0) || 0;

export interface SyncResult {
  /** Stocks added or raised (bought outside the app). */
  added: SyncChange[];
  /** Stocks lowered or removed (sold outside the app). */
  removed: SyncChange[];
  /** Open orders placed outside the app, now followed until they fill. */
  orders: number;
  /** Stocks left alone because an order is still on the way. */
  skipped: string[];
}

/**
 * Makes the Trade page's "My stocks" match the Alpaca account: new fills are
 * booked, stocks bought or sold outside the app are added or lowered (the
 * shares the investments hold stay theirs), and open orders placed outside
 * the app are followed. Then the tax records catch up in the background.
 */
@Injectable()
export class AlpacaSyncService {
  private readonly logger = new Logger(AlpacaSyncService.name);

  constructor(
    private readonly alpaca: AlpacaService,
    private readonly store: MyStocksStore,
    private readonly deployments: DeploymentStore,
    private readonly runner: MyStocksRunner,
    private readonly tax: TaxSyncService,
  ) {}

  async sync(now = new Date()): Promise<SyncResult> {
    await this.runner.bookFills();
    const [positions, open, live, stopped] = await Promise.all([
      this.alpaca.getPositions(),
      this.alpaca.listOrders({ status: 'open', limit: 500 }),
      this.deployments.live(),
      this.deployments.stoppedWithPending(),
    ]);
    const ledgers = [...live, ...stopped].flatMap((d) => d.ledgers);
    const investments: Record<string, number> = {};
    for (const l of ledgers)
      for (const p of Object.values(l.positions))
        investments[p.symbol] = (investments[p.symbol] ?? 0) + p.qty;

    const m = await this.store.get();
    const followed = new Set(
      [...ledgers, m.ledger].flatMap((l) =>
        l.pending.map((p) => p.clientOrderId),
      ),
    );
    const stocks = (o: { assetClass?: string | null }) =>
      !o.assetClass || o.assetClass === 'us_equity';
    const outside: PendingOrder[] = open
      .filter(
        (o) => stocks(o) && o.clientOrderId && !followed.has(o.clientOrderId),
      )
      .map((o) => ({
        clientOrderId: String(o.clientOrderId),
        symbol: String(o.symbol),
        side: o.side === 'sell' ? 'sell' : 'buy',
        qty: num(o.qty) || num(o.notional) / (num(o.limitPrice) || 1),
        reason: 'placed outside the app',
        submittedAt: new Date(o.submittedAt ?? now),
        bookedQty: num(o.filledQty),
        ...(o.notional ? { notional: num(o.notional) } : {}),
      }));
    // Shares still moving: any open order, or one a ledger waits on.
    const busy = new Set([
      ...open.map((o) => String(o.symbol)),
      ...[...ledgers, m.ledger].flatMap((l) => l.pending.map((p) => p.symbol)),
    ]);
    const account: AccountHolding[] = positions
      .filter((p) => stocks(p) && String(p.side) !== 'short')
      .map((p) => ({
        symbol: p.symbol,
        qty: num(p.qty),
        avgPrice: num(p.avgEntryPrice),
        price: num(p.currentPrice) || num(p.avgEntryPrice),
      }));
    const { changes, skipped } = syncChanges({
      account,
      investments,
      mine: m.ledger.positions,
      busy,
    });
    const since = await this.boughtDates(
      changes.filter((c) => c.side === 'buy'),
      account,
      now,
    );

    await this.store.update((mine) => {
      for (const o of outside) {
        mine.ledger.pending.push(o);
        mine.events.push({
          timestamp: now,
          message: `Following your ${o.side} order of ${o.symbol} (placed outside the app)`,
        });
      }
      for (const c of changes) {
        const outsideApp = c.side === 'buy' ? 'bought' : 'sold';
        bookFill(mine.ledger, {
          timestamp: c.side === 'buy' ? (since.get(c.symbol) ?? now) : now,
          symbol: c.symbol,
          side: c.side,
          qty: c.qty,
          price: c.price,
          reason: `synced from Alpaca (${outsideApp} outside the app)`,
        });
        mine.events.push({
          timestamp: now,
          message: `Synced from Alpaca: ${c.qty} ${c.symbol} ${outsideApp} outside the app`,
        });
      }
    });
    // The account's buys and sells with their shekel values (Tax page).
    if (this.tax.enabled) void this.tax.sync();
    if (changes.length || outside.length)
      this.logger.log(
        `Synced My stocks: ${changes.length} changes, ${outside.length} orders`,
      );
    return {
      added: changes.filter((c) => c.side === 'buy'),
      removed: changes.filter((c) => c.side === 'sell'),
      orders: outside.length,
      skipped,
    };
  }

  /** When the added shares were bought, from the account's filled buys of the last 2 years. */
  private async boughtDates(
    buys: SyncChange[],
    account: AccountHolding[],
    now: Date,
  ): Promise<Map<string, Date>> {
    const out = new Map<string, Date>();
    if (!buys.length) return out;
    const filled = await this.alpaca
      .listOrders({
        status: 'closed',
        symbols: buys.map((b) => b.symbol).join(','),
        side: 'buy',
        after: new Date(now.getTime() - 2 * YEAR_MS).toISOString(),
        direction: 'desc',
        limit: 500,
      })
      .catch(() => []);
    for (const b of buys) {
      const held = account.find((h) => h.symbol === b.symbol)?.qty ?? b.qty;
      const at = boughtSince(
        filled
          .filter(
            (o) => o.symbol === b.symbol && num(o.filledQty) > 0 && o.filledAt,
          )
          .map((o) => ({ qty: num(o.filledQty), at: new Date(o.filledAt!) })),
        held,
      );
      if (at) out.set(b.symbol, at);
    }
    return out;
  }
}
