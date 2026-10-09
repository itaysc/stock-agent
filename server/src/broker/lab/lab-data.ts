import { ConfigService } from '@nestjs/config';
import type { INestApplicationContext } from '@nestjs/common';
import { resolve } from 'node:path';
import { earningsDays } from '../../strategies/rotation/rotation-events.js';
import { fundamentals } from '../../strategies/rotation/rotation-fundamentals.js';
import type { StrategyBar } from '../../strategies/strategy.types.js';
import {
  announcementReturn,
  dailyCloses,
  quartersOf,
  sue,
} from './earnings-momentum.js';
import { fundamentalsFrom } from './fundamentals.js';
import { secEarningsDays } from './sec-announcements.js';
import { secFacts } from './sec-facts.js';

const secDir = () => resolve(process.cwd(), '.cache/sec');
const agent = (app: INestApplicationContext) =>
  app.get(ConfigService).get<string>('SEC_USER_AGENT') ?? '';

/** Past earnings-release days from the SEC, for earningsWait. */
export async function useEarningsDays(
  app: INestApplicationContext,
  symbols: string[],
): Promise<void> {
  earningsDays.set(await secEarningsDays(symbols, secDir(), agent(app)));
}

/**
 * The SEC reports as public on each day (value, quality, turnover and
 * earnings momentum), for blend and crowdFilter 2. Prices and volumes come
 * from `bars` (SPY among them, for the reaction to each earnings release).
 */
export async function useFundamentals(
  app: INestApplicationContext,
  symbols: string[],
  bars: Record<string, StrategyBar[]>,
): Promise<void> {
  const { facts } = await secFacts(symbols, secDir(), agent(app));
  const days = Object.fromEntries(
    Object.entries(bars).map(([s, l]) => [
      s,
      l.map((b) => b.timestamp.toISOString().slice(0, 10)),
    ]),
  );
  /** The index of the last bar on or before a day (-1: none). */
  const at = (symbol: string, day: string) => {
    const d = days[symbol] ?? [];
    let lo = 0;
    let hi = d.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (d[mid] <= day) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found;
  };
  const price = (s: string, day: string) => {
    const i = at(s, day);
    return i < 0 ? null : bars[s][i].close;
  };
  const dollarVolume = (s: string, day: string) => {
    const i = at(s, day);
    if (i < 125) return null;
    const last = bars[s].slice(i - 125, i + 1);
    return (
      last.reduce((n, b) => n + b.close * (b.volume ?? 0), 0) / last.length
    );
  };
  const base = fundamentalsFrom(facts, price, dollarVolume);
  const releases = await secEarningsDays(symbols, secDir(), agent(app));
  const income = new Map(
    Object.entries(facts).map(([s, f]) => [
      s,
      quartersOf(f, ['NetIncomeLoss', 'ProfitLoss']),
    ]),
  );
  const revenue = new Map(
    Object.entries(facts).map(([s, f]) => [
      s,
      quartersOf(f, [
        'Revenues',
        'RevenueFromContractWithCustomerExcludingAssessedTax',
        'SalesRevenueNet',
      ]),
    ]),
  );
  const closes = new Map(
    Object.entries(bars).map(([s, l]) => [s, dailyCloses(l)]),
  );
  const spy = closes.get('SPY') ?? { days: [], closes: [] };
  const memo = new Map<string, ReturnType<typeof base>>();
  fundamentals.set((s, atDate) => {
    const day = atDate.toISOString().slice(0, 10);
    const key = `${s}|${day}`;
    if (memo.has(key)) return memo.get(key) ?? null;
    const f = base(s, atDate);
    const stock = closes.get(s);
    const out = f && {
      ...f,
      sue: sue(income.get(s) ?? [], day),
      sueRev: sue(revenue.get(s) ?? [], day),
      ear: stock
        ? announcementReturn(stock, spy, releases[s] ?? [], day)
        : null,
    };
    memo.set(key, out);
    return out;
  });
}
