import { type CycleDeps, logEvent } from './deployment-events.js';
import type { Deployment, StagedBuy } from './deployment.types.js';
import { earningsLine } from './earnings-ai.js';
import { holdOff } from './manual-exits.js';

const DAY_MS = 86_400_000;
/** A buy waits when the stock reports within this many days. */
export const EARNINGS_WAIT_DAYS = 4;
/** Without the AI, an earnings miss this big (%) counts as clearly bad. */
export const NUMBERS_ONLY_MISS_PCT = -10;
/** The numbers can take a day to show up: after this long it reads the report anyway. */
const NUMBERS_WAIT_MS = 2 * DAY_MS;

/** Broker investments watch earnings (the research deployments keep their tested rules only). */
export const earningsOn = (d: Deployment) => d.source?.kind === 'broker';

const day = (t: Date) => t.toISOString().slice(0, 10);
/** A report is out after the close of its day (23:00 UTC also covers after-close reports). */
const reportOut = (date: string, now: Date) =>
  now.getTime() >= Date.parse(date) + 23 * 3_600_000;

/** The coming report day when it is within EARNINGS_WAIT_DAYS (a buy waits), or null. */
async function reportSoon(
  deps: CycleDeps,
  symbol: string,
  now: Date,
): Promise<string | null> {
  const next = await deps.nextEarnings(symbol).catch(() => null);
  if (!next || reportOut(next, now)) return null;
  const last = day(new Date(now.getTime() + EARNINGS_WAIT_DAYS * DAY_MS));
  return next <= last ? next : null;
}

/**
 * Reads a report that is out: clearly bad (avoid) or not, with the reason.
 * Null while the numbers aren't in yet (asked again next cycle).
 */
export async function readReport(
  deps: CycleDeps,
  symbol: string,
  date: string,
  now: Date,
): Promise<{ avoid: boolean; reason: string } | null> {
  const early = now.getTime() - Date.parse(date) < NUMBERS_WAIT_MS;
  let result = await deps.lastEarnings(symbol).catch(() => null);
  if (!result || result.date < date) {
    if (early) return null;
    result = null; // still not in: the headlines alone
  }
  const headlines = await deps
    .recentNews(symbol, new Date(Date.parse(date) - DAY_MS))
    .catch(() => []);
  const ai = await deps.aiEarningsCheck(symbol, result, headlines);
  if (ai)
    return {
      avoid: ai.avoid,
      reason: `${ai.reason} (${earningsLine(result)})`,
    };
  const miss = result?.surprisePct;
  return miss != null && miss <= NUMBERS_ONLY_MISS_PCT
    ? {
        avoid: true,
        reason: `${earningsLine(result)}: a clear miss (the AI is off, so by the numbers only)`,
      }
    : { avoid: false, reason: earningsLine(result) };
}

/**
 * Before a waiting buy goes out: wait while the stock's earnings are a few
 * days away, then read the report; a clearly bad one skips the buy (and the
 * stock for 30 days). 'go' = no earnings reason to hold it back.
 */
export async function earningsGate(
  d: Deployment,
  deps: CycleDeps,
  buy: StagedBuy,
  now: Date,
): Promise<'go' | 'wait' | { skip: string }> {
  if (!earningsOn(d)) return 'go';
  const soon = await reportSoon(deps, buy.symbol, now);
  if (soon) {
    if (buy.waitFor !== soon)
      logEvent(
        d,
        `Buy of ${buy.symbol} waits until after its earnings report on ${soon}`,
        now,
      );
    buy.waitFor = soon;
    return 'wait';
  }
  if (!buy.waitFor) return 'go';
  const verdict = await readReport(deps, buy.symbol, buy.waitFor, now);
  if (!verdict) return 'wait';
  if (!verdict.avoid) return 'go';
  holdOff(d, buy.symbol, now);
  return { skip: `its earnings report (${buy.waitFor}): ${verdict.reason}` };
}

/** How long a buy that waits for earnings may wait in all (instead of the usual 4 days). */
export const waitsForEarnings = (buy: StagedBuy, now: Date) =>
  !!buy.waitFor && now.getTime() <= Date.parse(buy.waitFor) + 4 * DAY_MS;

/**
 * Held stocks (every cycle): learns each one's next report day, and once a
 * report is out reads it once. A clearly bad report (a clear miss or a lower
 * forecast) sells the stock, keeps it out for 30 days, and tells you why.
 */
export async function watchEarnings(
  d: Deployment,
  deps: CycleDeps,
  now: Date,
): Promise<
  Array<{ sleeve: number; symbol: string; qty: number; why: string }>
> {
  if (!earningsOn(d) || d.status === 'stopped') return [];
  const state = (d.earnings ??= {});
  const held = new Set<string>();
  const sells: Array<{
    sleeve: number;
    symbol: string;
    qty: number;
    why: string;
  }> = [];
  for (const [i, ledger] of d.ledgers.entries())
    for (const p of Object.values(ledger.positions)) {
      held.add(p.symbol);
      const s = (state[p.symbol] ??= {});
      const due = !!s.next && reportOut(s.next, now) && s.seen !== s.next;
      if (!due) {
        const next = await deps.nextEarnings(p.symbol).catch(() => null);
        if (next) s.next = next;
        continue;
      }
      const date = s.next as string;
      const verdict = await readReport(deps, p.symbol, date, now);
      if (!verdict) continue;
      s.seen = date;
      const message = `Earnings report of ${p.symbol} (${date}): ${verdict.reason}${verdict.avoid ? '. Selling it, and not buying it again for 30 days.' : ''}`;
      logEvent(d, message, now);
      if (!verdict.avoid) continue;
      await deps.notify(`${d.name}: ${message}`);
      holdOff(d, p.symbol, now);
      sells.push({
        sleeve: i,
        symbol: p.symbol,
        qty: p.qty,
        why: 'a bad earnings report',
      });
    }
  for (const symbol of Object.keys(state))
    if (!held.has(symbol)) delete state[symbol];
  return sells;
}
