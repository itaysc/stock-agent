import { Injectable } from '@nestjs/common';
import { AlpacaService } from '../alpaca/alpaca.service.js';

/** A stock or ETF you can trade. */
export interface Asset {
  symbol: string;
  name: string;
  exchange: string;
  tradable: boolean;
  fractionable: boolean;
}

const DAY_MS = 86_400_000;
/** Words in a company name that don't tell companies apart ("Apple Inc. Common Stock" → "APPLE"). */
const FILLER =
  /\b(INC|CORP|CORPORATION|CO|COMPANY|LTD|PLC|LLC|SA|NV|AG|HOLDINGS?|GROUP|COMMON|STOCK|ORDINARY|SHARES?|CLASS [A-C]|ADS|ADR|THE)\b\.?/g;
const plainName = (name: string) =>
  name
    .toUpperCase()
    .replace(/[.,]/g, ' ')
    .replace(FILLER, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * The best matches for what you typed: the exact ticker first, then tickers
 * that start with it, then company names that contain it (shorter, more
 * familiar names first).
 */
export function searchAssets(all: Asset[], query: string, limit = 10): Asset[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  const words = q.split(/\s+/);
  const score = (a: Asset) => {
    const name = a.name.toUpperCase();
    if (a.symbol === q) return 0;
    if (a.symbol.startsWith(q)) return 1 + a.symbol.length / 100;
    if (plainName(a.name) === q) return 1.5;
    if (words.every((w) => name.includes(w)))
      return (name.startsWith(words[0]) ? 2 : 3) + name.length / 1000;
    return null;
  };
  return all
    .map((a) => ({ a, s: score(a) }))
    .filter((x): x is { a: Asset; s: number } => x.s !== null)
    .sort((x, y) => x.s - y.s)
    .slice(0, limit)
    .map((x) => x.a);
}

/** Every active US stock and ETF on Alpaca, kept for a day (about 10,000; one request). */
@Injectable()
export class AssetsService {
  private cache: { at: number; list: Asset[] } | null = null;

  constructor(private readonly alpaca: AlpacaService) {}

  async all(): Promise<Asset[]> {
    if (this.cache && Date.now() - this.cache.at < DAY_MS)
      return this.cache.list;
    const raw = await this.alpaca.client.trading.assets.getV2Assets({
      status: 'active',
      assetClass: 'us_equity',
    });
    const list = raw
      .filter((a) => a.tradable && a.symbol)
      .map((a) => ({
        symbol: a.symbol,
        name: a.name ?? a.symbol,
        exchange: String(a.exchange ?? ''),
        tradable: !!a.tradable,
        fractionable: !!a.fractionable,
      }));
    this.cache = { at: Date.now(), list };
    return list;
  }

  async search(query: string): Promise<Asset[]> {
    return searchAssets(await this.all(), query);
  }

  /** One asset by ticker (null: not tradable on Alpaca). */
  async find(symbol: string): Promise<Asset | null> {
    const s = symbol.toUpperCase();
    return (await this.all()).find((a) => a.symbol === s) ?? null;
  }
}
