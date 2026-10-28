import type { Alpaca } from '@alpacahq/alpaca-trade-api';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlpacaAccounts } from '../accounts/alpaca-accounts.service.js';
import type { Env } from '../config/env.js';

/** A stock's price now and at the last close. */
export interface Quote {
  price: number;
  lastClose: number;
}

/** Splits, dividends, mergers… (Alpaca's corporate actions, by kind). */
export type CorporateActions = Awaited<
  ReturnType<Alpaca['marketData']['corporateActions']['corporateActions']>
>['corporateActions'];

const QUOTE_MS = 15_000;
const ASSET_MS = 24 * 60 * 60_000;
const CLOCK_MS = 30_000;

/**
 * Prices, stock details and the market clock for the paper accounts, from
 * the app's market data (a real Alpaca account's client). Cached briefly, so
 * many paper accounts don't multiply requests on that one key.
 */
@Injectable()
export class SimMarket {
  private readonly feed: Env['ALPACA_DATA_FEED'];
  private readonly quoteCache = new Map<string, { at: number; quote: Quote }>();
  private readonly assets = new Map<
    string,
    { at: number; asset: { tradable: boolean; fractionable: boolean } | null }
  >();
  private clock?: { at: number; isOpen: boolean; nextOpen: Date };

  constructor(
    private readonly accounts: AlpacaAccounts,
    config: ConfigService<Env, true>,
  ) {
    this.feed = config.get('ALPACA_DATA_FEED', { infer: true });
  }

  private get data() {
    return this.accounts.dataClient();
  }

  /** Each symbol's price now and its last close (one request for the ones not cached). */
  async quotes(symbols: string[]): Promise<Map<string, Quote>> {
    const now = Date.now();
    const out = new Map<string, Quote>();
    const missing: string[] = [];
    for (const s of new Set(symbols)) {
      const hit = this.quoteCache.get(s);
      if (hit && now - hit.at < QUOTE_MS) out.set(s, hit.quote);
      else missing.push(s);
    }
    if (missing.length) {
      const snaps = await this.data.marketData.stocks.stockSnapshots({
        symbols: missing.join(','),
        feed: this.feed,
      });
      for (const [s, snap] of Object.entries(snaps)) {
        const price = snap.latestTrade?.p ?? snap.dailyBar?.c ?? 0;
        const quote = { price, lastClose: snap.prevDailyBar?.c ?? price };
        this.quoteCache.set(s, { at: now, quote });
        out.set(s, quote);
      }
    }
    return out;
  }

  async price(symbol: string): Promise<number> {
    return (await this.quotes([symbol])).get(symbol)?.price ?? 0;
  }

  /** Whether the stock trades on Alpaca, and in fractions (null: no such stock). */
  async asset(
    symbol: string,
  ): Promise<{ tradable: boolean; fractionable: boolean } | null> {
    const hit = this.assets.get(symbol);
    if (hit && Date.now() - hit.at < ASSET_MS) return hit.asset;
    const asset = await this.data.trading.assets
      .getV2AssetsSymbolOrAssetId({ symbolOrAssetId: symbol })
      .then(
        (a) => ({
          tradable: a.tradable && a.status === 'active',
          fractionable: a.fractionable,
        }),
        (err: Error) => {
          if (err.name === 'NotFoundError') return null;
          throw err;
        },
      );
    this.assets.set(symbol, { at: Date.now(), asset });
    return asset;
  }

  async isOpen(): Promise<boolean> {
    if (this.clock && Date.now() - this.clock.at < CLOCK_MS)
      return this.clock.isOpen;
    const c = await this.data.trading.clock.legacyClock();
    this.clock = { at: Date.now(), isOpen: c.isOpen, nextOpen: c.nextOpen };
    return c.isOpen;
  }

  /** Splits and cash dividends of these stocks since `start`. */
  async corporateActions(
    symbols: string[],
    start: Date,
  ): Promise<CorporateActions> {
    if (!symbols.length) return {};
    const res = await this.data.marketData.corporateActions.corporateActions({
      symbols: symbols.join(','),
      types: 'forward_split,reverse_split,cash_dividend',
      start,
      limit: 1000,
    });
    return res.corporateActions;
  }
}
