import type { Fundamentals } from '../../strategies/rotation/rotation-fundamentals.js';
import type { Fact, Facts } from './sec-facts.js';

const DAY_MS = 86_400_000;
const day = (d: Date) => d.toISOString().slice(0, 10);

/** Figures older than this (a concept the company stopped reporting) don't count. */
const STALE_DAYS = 550;

/** The value for the latest period that had been filed by `at` (yearly ones: a 12-month span). */
function latest(
  list: Fact[] | undefined,
  at: string,
  yearly: boolean,
  staleDays = STALE_DAYS,
): Fact | null {
  let best: Fact | null = null;
  for (const f of list ?? []) {
    if (f.filed > at) continue;
    if (yearly) {
      if (!f.start) continue;
      const span = (Date.parse(f.end) - Date.parse(f.start)) / DAY_MS;
      if (span < 330 || span > 400) continue;
    } else if (f.start) continue;
    // The latest period wins; for the same period, the latest filing (a restatement).
    if (
      !best ||
      f.end > best.end ||
      (f.end === best.end && f.filed > best.filed)
    )
      best = f;
  }
  if (best && (Date.parse(at) - Date.parse(best.end)) / DAY_MS > staleDays)
    return null;
  return best;
}
/** The freshest figure among names a company may have used for the same thing. */
const freshest = (
  facts: Facts,
  names: string[],
  at: string,
  yearly: boolean,
): Fact | null =>
  names
    .map((n) => latest(facts[n], at, yearly))
    .reduce<Fact | null>((a, b) => (b && (!a || b.end > a.end) ? b : a), null);

/**
 * Point-in-time value and quality numbers from SEC facts. Market value: the
 * public float on the latest annual report, moved by the stock's price since
 * that date (the lab's prices are split-adjusted, so shares × price would be
 * wrong across splits). `price(symbol, day)` is the close on or before a day.
 */
export function fundamentalsFrom(
  facts: Record<string, Facts>,
  price: (symbol: string, at: string) => number | null,
): (symbol: string, at: Date) => Fundamentals | null {
  const memo = new Map<string, Fundamentals | null>();
  return (symbol, atDate) => {
    const at = day(atDate);
    const key = `${symbol}|${at}`;
    if (memo.has(key)) return memo.get(key) ?? null;
    const f = facts[symbol];
    let out: Fundamentals | null = null;
    if (f) {
      // The float is measured mid-year and filed with the annual report: up to ~21 months old (moved by the price since).
      const float = latest(f.EntityPublicFloat, at, false, 800);
      const now = price(symbol, at);
      const then = float && price(symbol, float.end);
      const cap = float && now && then ? (float.val * now) / then : null;
      const income =
        freshest(f, ['NetIncomeLoss', 'ProfitLoss'], at, true)?.val ?? null;
      const revenue = freshest(
        f,
        [
          'Revenues',
          'RevenueFromContractWithCustomerExcludingAssessedTax',
          'SalesRevenueNet',
        ],
        at,
        true,
      );
      const cost = freshest(
        f,
        ['CostOfRevenue', 'CostOfGoodsAndServicesSold'],
        at,
        true,
      );
      const reported = freshest(f, ['GrossProfit'], at, true);
      const gross =
        revenue &&
        cost &&
        revenue.end === cost.end &&
        (!reported || revenue.end > reported.end)
          ? revenue.val - cost.val
          : (reported?.val ?? null);
      const assets = freshest(f, ['Assets'], at, false)?.val ?? null;
      const equity =
        freshest(f, ['StockholdersEquity'], at, false)?.val ?? null;
      const per = (x: number | null, y: number | null) =>
        x !== null && y ? x / y : null;
      out = {
        ep: per(income, cap),
        bm: per(equity, cap),
        gpa: per(gross, assets),
        roa: per(income, assets),
      };
    }
    memo.set(key, out);
    return out;
  };
}
