import { Injectable } from '@nestjs/common';
import { InjectModel, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AccountContext } from '../accounts/account-context.js';
import type { ManualLevels, SleeveLedger } from '../paper/deployment.types.js';
import { emptyLedger } from '../paper/sleeve-ledger.js';

/** One line of what happened (a fill, a refusal, a level hit). */
export interface MyStocksEvent {
  timestamp: Date;
  message: string;
}

/**
 * The stocks you buy and sell yourself (the Trade page), kept apart from the
 * broker's investments: Alpaca holds one position per stock for the whole
 * account, and this ledger says how much of it is yours. Its cash is not
 * used (your buys come out of the account's free cash).
 */
export interface MyStocks {
  /** The Alpaca account these are on (its account number). */
  key: string;
  ledger: SleeveLedger;
  levels: Record<string, ManualLevels>;
  watchlist: string[];
  /** The last daily close your levels were checked on. */
  levelsCheckedAt?: Date | null;
  events: MyStocksEvent[];
}

@Schema({ collection: 'my_stocks', timestamps: true })
export class MyStocksDoc {
  @Prop({ type: String, required: true, unique: true }) key: string;
  @Prop({ type: Object, required: true }) ledger: SleeveLedger;
  @Prop({ type: Object, default: {} }) levels: Record<string, ManualLevels>;
  @Prop({ type: [String], default: [] }) watchlist: string[];
  @Prop({ type: Date, default: null }) levelsCheckedAt?: Date | null;
  @Prop({ type: Array, default: [] }) events: MyStocksEvent[];
}

export const MyStocksSchema = SchemaFactory.createForClass(MyStocksDoc);

const MAX_EVENTS = 200;

@Injectable()
export class MyStocksStore {
  /** Changes run one at a time (the fill poller and your orders both write). */
  private lock: Promise<unknown> = Promise.resolve();

  constructor(
    @InjectModel(MyStocksDoc.name) private readonly docs: Model<MyStocksDoc>,
  ) {}

  private get key(): string {
    return AccountContext.id();
  }

  /** Yours (an empty one the first time). */
  async get(): Promise<MyStocks> {
    const doc = await this.docs.findOne({ key: this.key }).lean();
    return doc
      ? {
          key: doc.key,
          ledger: doc.ledger,
          levels: doc.levels ?? {},
          watchlist: doc.watchlist ?? [],
          levelsCheckedAt: doc.levelsCheckedAt ?? null,
          events: doc.events ?? [],
        }
      : {
          key: this.key,
          ledger: emptyLedger(0),
          levels: {},
          watchlist: [],
          levelsCheckedAt: null,
          events: [],
        };
  }

  async save(m: MyStocks): Promise<void> {
    m.events = m.events.slice(-MAX_EVENTS);
    await this.docs.updateOne(
      { key: m.key },
      {
        $set: {
          ledger: m.ledger,
          levels: m.levels,
          watchlist: m.watchlist,
          levelsCheckedAt: m.levelsCheckedAt ?? null,
          events: m.events,
        },
      },
      { upsert: true },
    );
  }

  /** Reads, changes (with `change`) and saves, one change at a time. */
  update<T>(change: (m: MyStocks) => T | Promise<T>): Promise<T> {
    const run = this.lock.then(async () => {
      const m = await this.get();
      const out = await change(m);
      await this.save(m);
      return out;
    });
    this.lock = run.catch(() => undefined);
    return run;
  }

  /** Shares of a stock that are yours (not any investment's). */
  async heldQty(symbol: string): Promise<number> {
    return (await this.get()).ledger.positions[symbol]?.qty ?? 0;
  }

  /** Dollars your buys that haven't filled yet will take from the free cash. */
  async pendingBuyCash(): Promise<number> {
    const { ledger } = await this.get();
    return ledger.pending
      .filter((p) => p.side === 'buy')
      .reduce(
        (n, p) =>
          n + (p.notional ?? p.qty * (ledger.lastPrices[p.symbol] ?? 0)),
        0,
      );
  }
}
