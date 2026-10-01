import { createHash } from 'node:crypto';
import type { StrategyBar } from '../../strategies/strategy.types.js';

export interface RunConfig {
  strategy: string;
  /** Every param value, defaults included (so `fast=20` equals "defaults"). */
  params: Record<string, number>;
  /** Kept in order: it decides which symbol acts first on a shared bar. */
  symbols: string[];
  timeframe: string;
  from: Date;
  to: Date;
  initialCash: number;
  slippageBps: number;
  feePerShare: number;
  cashYieldPct?: number;
  newsGateTone?: number;
}

const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');

/** Identifies a test setup. Versions are stored beside it, not in it, so a stale record can be found and replaced. */
export function runFingerprint(config: RunConfig): string {
  const params = Object.fromEntries(
    Object.entries(config.params).sort(([a], [b]) => a.localeCompare(b)),
  );
  return sha256(
    JSON.stringify({
      strategy: config.strategy,
      params,
      symbols: config.symbols,
      timeframe: config.timeframe,
      from: config.from.toISOString().slice(0, 10),
      to: config.to.toISOString().slice(0, 10),
      initialCash: config.initialCash,
      slippageBps: config.slippageBps,
      feePerShare: config.feePerShare,
      cashYieldPct: config.cashYieldPct ?? 0,
      newsGateTone: config.newsGateTone ?? 0,
    }),
  );
}

/** Hash of the market data itself, so changed bars (e.g. new split adjustments) make a record stale. */
export function dataHash(bars: Record<string, StrategyBar[]>): string {
  const compact = Object.entries(bars).map(([symbol, list]) => [
    symbol,
    list.map((b) => [
      b.timestamp.getTime(),
      b.open,
      b.high,
      b.low,
      b.close,
      b.volume,
      // News and earnings only count when attached (so plain bars hash as before).
      ...(b.news ? [b.news.tone, b.news.count] : []),
      ...(b.earnings
        ? [
            b.earnings.daysToNext,
            b.earnings.daysSinceLast,
            b.earnings.lastSurprisePct,
          ]
        : []),
    ]),
  ]);
  return sha256(JSON.stringify(compact));
}

/**
 * Deep copy without `undefined` fields. The MongoDB driver would store them as
 * null, and optional fields (e.g. a buy's realizedPnl) must come back absent.
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripUndefined) as T;
  if (value instanceof Date || value === null || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, stripUndefined(v)]),
  ) as T;
}
