import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RENAMED } from './yahoo-history.js';

/** One reported number: the period it covers, and when it was filed (known from then on). */
export interface Fact {
  start?: string;
  end: string;
  val: number;
  filed: string;
}
/** Concept name → its reported values. */
export type Facts = Record<string, Fact[]>;

/** The SEC concepts the lab uses (the rest of each company's file is dropped). */
const CONCEPTS = {
  'us-gaap': [
    'NetIncomeLoss',
    'ProfitLoss',
    'Revenues',
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'SalesRevenueNet',
    'GrossProfit',
    'CostOfRevenue',
    'CostOfGoodsAndServicesSold',
    'OperatingIncomeLoss',
    'Assets',
    'Liabilities',
    'StockholdersEquity',
  ],
  dei: ['EntityPublicFloat'],
};
/** Companies that re-registered under a new SEC id: their earlier reports are under these. */
const PREDECESSORS: Record<string, number[]> = {
  GOOGL: [1288776], // Google Inc. (before Alphabet, 2015)
  GOOG: [1288776],
  DIS: [1001039], // The Walt Disney Company before the 2019 holding company
  AVGO: [1441634], // Avago Technologies
  XOM: [34088], // Exxon Mobil before its new holding company
};
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson(url: string, userAgent: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'User-Agent': userAgent, Accept: 'application/json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`SEC ${res.status} for ${url}`);
  return res.json();
}

/**
 * Each symbol's financial facts from SEC EDGAR (free; the SEC asks for a
 * contact in the User-Agent: SEC_USER_AGENT), as filed, so a backtest only
 * sees what was public on each day. Cached per symbol in `cacheDir`.
 * Symbols the SEC no longer lists (most delisted companies) come back missing.
 */
export async function secFacts(
  symbols: string[],
  cacheDir: string,
  userAgent: string,
): Promise<{ facts: Record<string, Facts>; missing: string[] }> {
  mkdirSync(cacheDir, { recursive: true });
  const tickersFile = join(cacheDir, 'company_tickers.json');
  if (!existsSync(tickersFile)) {
    if (!userAgent) throw new Error('Set SEC_USER_AGENT in server/.env first');
    const t = await getJson(
      'https://www.sec.gov/files/company_tickers.json',
      userAgent,
    );
    writeFileSync(tickersFile, JSON.stringify(t));
  }
  const listed = Object.values(
    JSON.parse(readFileSync(tickersFile, 'utf8')) as Record<
      string,
      { cik_str: number; ticker: string }
    >,
  );
  const cikOf = new Map(listed.map((x) => [x.ticker, x.cik_str]));
  const facts: Record<string, Facts> = {};
  const missing: string[] = [];
  for (const symbol of symbols) {
    const file = join(cacheDir, `${symbol}.json`);
    if (existsSync(file)) {
      const cached = JSON.parse(readFileSync(file, 'utf8')) as Facts | null;
      if (cached) facts[symbol] = cached;
      else missing.push(symbol);
      continue;
    }
    const cik = cikOf.get((RENAMED[symbol] ?? symbol).replace('.', '-'));
    let kept: Facts | null = null;
    for (const id of [...(PREDECESSORS[symbol] ?? []), ...(cik ? [cik] : [])]) {
      const raw = (await getJson(
        `https://data.sec.gov/api/xbrl/companyfacts/CIK${String(id).padStart(10, '0')}.json`,
        userAgent,
      )) as {
        facts?: Record<
          string,
          Record<string, { units: Record<string, Fact[]> }>
        >;
      } | null;
      await pause(150); // the SEC allows 10 requests a second
      if (!raw?.facts) continue;
      const part = strip(raw.facts);
      kept ??= {};
      for (const [name, list] of Object.entries(part))
        kept[name] = [...(kept[name] ?? []), ...list];
    }
    writeFileSync(file, JSON.stringify(kept));
    if (kept) facts[symbol] = kept;
    else missing.push(symbol);
  }
  return { facts, missing };
}

/** Only the concepts in CONCEPTS, in dollars, as {start, end, val, filed}. */
function strip(
  all: Record<string, Record<string, { units: Record<string, Fact[]> }>>,
): Facts {
  const out: Facts = {};
  for (const [taxonomy, names] of Object.entries(CONCEPTS))
    for (const name of names) {
      const usd = all[taxonomy]?.[name]?.units.USD;
      if (usd)
        out[name] = usd.map(({ start, end, val, filed }) => ({
          ...(start ? { start } : {}),
          end,
          val,
          filed,
        }));
    }
  return out;
}
