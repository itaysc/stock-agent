import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import YahooFinance from 'yahoo-finance2';
import type { StrategyBar } from '../../strategies/strategy.types.js';

const DAY_MS = 86_400_000;
const yahoo = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

interface Cached {
  from: string;
  to: string;
  bars: Array<Omit<StrategyBar, 'timestamp'> & { timestamp: string }>;
}

/** One daily row as Yahoo sends it (any field can be missing in old records). */
interface YahooQuote {
  date: Date | string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  adjclose?: number | null;
  volume?: number | null;
}

/** Tickers that changed (Yahoo keeps the history under the new one). */
export const RENAMED: Record<string, string> = {
  FB: 'META',
  ANTM: 'ELV',
  FISV: 'FI',
  ABC: 'COR',
};
/** Yahoo spells class shares with a dash: BRK.B → BRK-B. */
const yahooSymbol = (s: string) => (RENAMED[s] ?? s).replace('.', '-');

/**
 * Daily bars from Yahoo Finance (free, no key; unofficial, personal use) for
 * long backtests: split- and dividend-adjusted like Alpaca's adjustment
 * 'all', dated at 00:00 UTC of the trading day. Each symbol is cached on disk
 * and only re-fetched when the cache does not cover the range.
 * For the algo lab only: the broker trades on Alpaca's data.
 */
export async function yahooDaily(
  symbols: string[],
  from: Date,
  to: Date,
  cacheDir: string,
): Promise<Record<string, StrategyBar[]>> {
  mkdirSync(cacheDir, { recursive: true });
  const out: Record<string, StrategyBar[]> = {};
  for (const symbol of symbols) {
    const file = join(cacheDir, `${yahooSymbol(symbol)}.json`);
    const cached = existsSync(file)
      ? (JSON.parse(readFileSync(file, 'utf8')) as Cached)
      : null;
    const covers =
      cached &&
      new Date(cached.from) <= from &&
      new Date(cached.to).getTime() >= to.getTime() - 3 * DAY_MS;
    const bars = covers ? cached.bars : await fetchSymbol(symbol, from, to);
    if (!covers)
      writeFileSync(
        file,
        JSON.stringify({
          from: from.toISOString(),
          to: to.toISOString(),
          bars,
        }),
      );
    out[symbol] = bars
      .map((b) => ({ ...b, symbol, timestamp: new Date(b.timestamp) }))
      .filter((b) => b.timestamp >= from && b.timestamp <= to);
  }
  return out;
}

async function fetchSymbol(
  symbol: string,
  from: Date,
  to: Date,
): Promise<Cached['bars']> {
  for (let attempt = 0; ; attempt++) {
    try {
      // Old records of bought-out companies can be malformed: take what parses, skip the rest.
      const r = (await yahoo.chart(
        yahooSymbol(symbol),
        { period1: from, period2: to, interval: '1d' },
        { validateResult: false },
      )) as { quotes?: YahooQuote[] };
      await new Promise((ok) => setTimeout(ok, 250)); // be gentle: it is a free, unofficial API
      return (r.quotes ?? [])
        .filter((q) => q.close != null && q.adjclose != null && q.open != null)
        .map((q) => {
          // adjclose includes dividends; scale the whole bar by the same factor.
          const k = (q.adjclose as number) / (q.close as number);
          return {
            symbol,
            timestamp: new Date(
              new Date(q.date).toISOString().slice(0, 10),
            ).toISOString(),
            open: (q.open as number) * k,
            high: (q.high as number) * k,
            low: (q.low as number) * k,
            close: q.adjclose as number,
            volume: q.volume ?? 0,
          };
        });
    } catch (err) {
      // Delisted, bought out or not trading then: Yahoo has nothing (cached as empty, no retries).
      if (
        /No data found|Data doesn't exist|Not Found|Schema validation/i.test(
          (err as Error).message,
        )
      )
        return [];
      if (attempt >= 2)
        throw new Error(`Yahoo ${symbol}: ${(err as Error).message}`);
      await new Promise((ok) => setTimeout(ok, 5_000 * (attempt + 1)));
    }
  }
}

/** Each symbol's sector from Yahoo (today's: a company that changed business keeps its new one), cached in `file`. */
export async function yahooSectors(
  symbols: string[],
  file: string,
): Promise<Record<string, string>> {
  const cached: Record<string, string> = existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>)
    : {};
  for (const symbol of symbols.filter((s) => !(s in cached))) {
    try {
      const r = (await yahoo.quoteSummary(
        yahooSymbol(symbol),
        { modules: ['assetProfile'] },
        { validateResult: false },
      )) as {
        assetProfile?: { sector?: string };
      };
      cached[symbol] = r.assetProfile?.sector ?? '';
    } catch {
      cached[symbol] = ''; // unknown: counts as its own sector
    }
    await new Promise((ok) => setTimeout(ok, 250));
  }
  writeFileSync(file, JSON.stringify(cached, null, 1));
  return cached;
}
