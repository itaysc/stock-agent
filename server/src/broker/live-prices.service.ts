import { Injectable } from '@nestjs/common';
import { AlpacaService } from '../alpaca/alpaca.service.js';

const CACHE_MS = 60_000;

/**
 * The latest traded price of symbols, for the page (the trading itself uses
 * closing prices). The last answer is cached for a minute, so reloads and
 * several open tabs don't each ask Alpaca.
 */
@Injectable()
export class LivePricesService {
  private last: {
    key: string;
    at: number;
    prices: Record<string, { price: number; at: Date }>;
  } | null = null;

  constructor(private readonly alpaca: AlpacaService) {}

  async prices(symbols: string[]) {
    const key = [...new Set(symbols)].sort().join(',');
    if (this.last?.key === key && Date.now() - this.last.at < CACHE_MS)
      return { prices: this.last.prices };
    const prices = await this.alpaca.getLatestTrades(key ? key.split(',') : []);
    this.last = { key, at: Date.now(), prices };
    return { prices };
  }
}
