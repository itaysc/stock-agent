import { headlineTone } from '../info/headline-tone.js';
import { bigHoldings, ETF_PROFILES } from '../info/etf-profiles.js';
import {
  describeItems,
  REVIEW_ITEMS,
  VETO_ITEMS,
} from '../info/official/filing-items.js';
import type {
  CycleDeps,
  Headline,
  OfficialEvents,
} from './deployment-events.js';
import type { NewsCheck } from './deployment.types.js';

/** A single headline this negative is "severe": the AI (when on) decides whether it really is. */
export const SEVERE_TONE = -0.6;
/** Big holdings checked for an ETF (weight ≥ 5%, at most this many). */
const MAX_HOLDINGS = 5;

const quote = (h: Headline) => `"${h.headline.slice(0, 120)}"`;

/** A halt or a severe 8-K: official facts that settle it without the AI. */
function officialVeto(symbol: string, o: OfficialEvents): string | null {
  if (o.halt) return `trading in ${symbol} is halted (${o.halt.reason})`;
  const severe = o.filings.find((f) => f.items.some((i) => VETO_ITEMS[i]));
  return severe
    ? `${symbol} filed an 8-K with the SEC: ${describeItems(severe.items, VETO_ITEMS)} (${severe.url})`
    : null;
}

/** Notable filings as extra lines for the AI to read with the headlines. */
const filingLines = (o: OfficialEvents): Headline[] =>
  o.filings
    .filter((f) => f.items.some((i) => REVIEW_ITEMS[i]))
    .map((f) => ({
      headline: `[SEC ${f.form} filing] ${describeItems(f.items, REVIEW_ITEMS)}`,
      createdAt: f.acceptedAt,
    }));

/**
 * A company: official facts, then the headlines (tone, for buys only; the AI;
 * or, without the AI, a severe headline). For holds the AI only looks when
 * something severe or notable showed up, so quiet days cost nothing.
 */
async function assessCompany(
  check: NewsCheck,
  deps: CycleDeps,
  symbol: string,
  since: Date,
  purpose: 'buy' | 'hold',
  toneCheck: boolean,
): Promise<string | null> {
  const official = await deps.officialEvents(symbol, since);
  const veto = officialVeto(symbol, official);
  if (veto) return veto;
  const notes = filingLines(official);
  const headlines = [...(await deps.recentNews(symbol, since)), ...notes];
  if (headlines.length === 0) return null;
  const scored = headlines.map((h) => ({
    ...h,
    tone: headlineTone(h.headline),
  }));
  const worst = scored.reduce((w, h) => (h.tone < w.tone ? h : w));
  if (purpose === 'buy' && toneCheck && check.tone > 0) {
    const avg = scored.reduce((n, h) => n + h.tone, 0) / scored.length;
    if (avg <= -check.tone)
      return `the news since the signal is negative (tone ${avg.toFixed(2)} over ${scored.length} headlines, e.g. ${quote(worst)})`;
  }
  const alarming = worst.tone <= SEVERE_TONE || notes.length > 0;
  if (check.ai && (purpose === 'buy' || alarming)) {
    const verdict = await deps.aiNewsCheck(
      symbol,
      headlines,
      purpose,
      'company',
    );
    if (verdict)
      return verdict.avoid
        ? `the AI flagged the news: ${verdict.reason}`
        : null;
  }
  return worst.tone <= SEVERE_TONE
    ? `a severe headline: ${quote(worst)}`
    : null;
}

/** A fund: market-wide emergencies in its own news, then its big holdings like companies. */
async function assessFund(
  check: NewsCheck,
  deps: CycleDeps,
  symbol: string,
  since: Date,
  purpose: 'buy' | 'hold',
): Promise<string | null> {
  const halt = (await deps.officialEvents(symbol, since)).halt;
  if (halt) return `trading in ${symbol} is halted (${halt.reason})`;
  const own = await deps.recentNews(symbol, since);
  const severe = own.some((h) => headlineTone(h.headline) <= SEVERE_TONE);
  if (check.ai && own.length && (purpose === 'buy' || severe)) {
    const verdict = await deps.aiNewsCheck(symbol, own, purpose, 'market');
    if (verdict?.avoid)
      return `the AI sees a market-wide emergency: ${verdict.reason}`;
  }
  for (const [holding, weight] of bigHoldings(symbol).slice(0, MAX_HOLDINGS)) {
    const why = await assessCompany(
      check,
      deps,
      holding,
      since,
      purpose,
      false,
    );
    if (why) return `${holding} (about ${weight}% of the fund): ${why}`;
  }
  return null;
}

/**
 * Why not to buy (purpose "buy") or why to worry about a holding ("hold"),
 * given what happened since `since`; null when all is fine.
 */
export function assessNews(
  check: NewsCheck,
  deps: CycleDeps,
  symbol: string,
  since: Date,
  purpose: 'buy' | 'hold',
): Promise<string | null> {
  return ETF_PROFILES[symbol]
    ? assessFund(check, deps, symbol, since, purpose)
    : assessCompany(check, deps, symbol, since, purpose, true);
}
