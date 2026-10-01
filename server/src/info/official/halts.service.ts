import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

const FEED = 'https://www.nasdaqtrader.com/rss.aspx?feed=tradehalts';
const CACHE_MS = 2 * 60_000;

/** Common halt reason codes, in plain words. */
const REASONS: Record<string, string> = {
  T1: 'news pending',
  T2: 'news released',
  T3: 'news and resumption times',
  T5: 'single-stock trading pause',
  T6: 'extraordinary market activity',
  T8: 'ETF halt',
  T12: 'more information requested by Nasdaq',
  H4: 'not in compliance with listing rules',
  H9: 'not current in filings',
  H10: 'SEC trading suspension',
  H11: 'regulatory concern',
  LUDP: 'volatility pause (limit up / limit down)',
  LUDS: 'volatility pause (straddle)',
  MWC1: 'market-wide circuit breaker level 1',
  MWC2: 'market-wide circuit breaker level 2',
  MWC3: 'market-wide circuit breaker level 3',
  M: 'volatility pause',
  D: 'security deletion',
};

export interface Halt {
  symbol: string;
  reasonCode: string;
  reason: string;
  haltedAt: string;
}

interface FeedItem {
  'ndaq:IssueSymbol'?: string;
  'ndaq:ReasonCode'?: string;
  'ndaq:HaltDate'?: string;
  'ndaq:HaltTime'?: string;
  'ndaq:ResumptionTradeTime'?: string;
}

/** Securities halted right now, from Nasdaq Trader's official trade halt feed (cached 2 min). */
@Injectable()
export class HaltsService {
  private readonly logger = new Logger(HaltsService.name);
  private cache: { at: number; halts: Map<string, Halt> } | null = null;
  private readonly parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
  });

  /** The current halt of a symbol, or null. Network trouble = null (logged): the other checks still run. */
  async haltOf(symbol: string): Promise<Halt | null> {
    try {
      return (await this.current()).get(symbol.toUpperCase()) ?? null;
    } catch (err) {
      this.logger.warn(
        `Trade halt feed unavailable: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private async current(): Promise<Map<string, Halt>> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS)
      return this.cache.halts;
    const res = await fetch(FEED, {
      headers: { 'User-Agent': 'Mozilla/5.0 (stock-invest)' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    this.cache = {
      at: Date.now(),
      halts: parseHalts(this.parser.parse(await res.text())),
    };
    return this.cache.halts;
  }
}

/** Halts still in force: listed in the feed with no resumption trade time yet. */
export function parseHalts(feed: {
  rss?: { channel?: { item?: FeedItem | FeedItem[] } };
}): Map<string, Halt> {
  const items = [feed.rss?.channel?.item ?? []].flat();
  const halts = new Map<string, Halt>();
  for (const item of items) {
    const symbol = String(item['ndaq:IssueSymbol'] ?? '')
      .trim()
      .toUpperCase();
    const resumed = String(item['ndaq:ResumptionTradeTime'] ?? '').trim();
    if (!symbol || resumed) continue;
    const code = String(item['ndaq:ReasonCode'] ?? '').trim();
    halts.set(symbol, {
      symbol,
      reasonCode: code,
      reason: REASONS[code] ?? `reason code ${code || 'unknown'}`,
      haltedAt:
        `${item['ndaq:HaltDate'] ?? ''} ${item['ndaq:HaltTime'] ?? ''}`.trim(),
    });
  }
  return halts;
}
