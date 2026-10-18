import { headlineTone } from '../info/headline-tone.js';
import { industryOf } from '../info/industry-groups.js';
import {
  type CycleDeps,
  type Headline,
  logEvent,
} from './deployment-events.js';
import type { Deployment } from './deployment.types.js';
import { SEVERE_TONE } from './news-assess.js';

/** The peers' and the industry fund's headlines since `since`, newest first, each once. */
async function industryNews(
  deps: CycleDeps,
  symbols: string[],
  since: Date,
): Promise<Headline[]> {
  const seen = new Set<string>();
  const out: Headline[] = [];
  for (const s of symbols)
    for (const h of await deps.recentNews(s, since))
      if (!seen.has(h.headline)) {
        seen.add(h.headline);
        out.push(h);
      }
  return out.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/** The AI's verdict on the stock's industry news (null: nothing to read, no AI, or fine). */
async function shock(
  d: Deployment,
  deps: CycleDeps,
  symbol: string,
  since: Date,
  purpose: 'buy' | 'hold',
): Promise<{ group: string; reason: string } | null> {
  const ind = industryOf(symbol);
  if (!ind || !d.newsCheck?.ai || d.newsCheck.industry === 'off') return null;
  const news = await industryNews(deps, [...ind.members, ind.etf], since);
  // For holdings the AI only looks when a headline reads alarming (quiet days cost nothing).
  if (
    !news.length ||
    (purpose === 'hold' &&
      !news.some((h) => headlineTone(h.headline) <= SEVERE_TONE))
  )
    return null;
  const verdict = await deps.aiNewsCheck(
    `${symbol} (${ind.group}: ${[...ind.members, ind.etf].join(', ')})`,
    news,
    purpose,
    'industry',
  );
  return verdict?.avoid ? { group: ind.group, reason: verdict.reason } : null;
}

/**
 * Before a buy: an industry-wide shock in the peers' news. With industry
 * "on" it's a reason to skip the buy; in the trial (the default) it's only
 * logged, so its calls can be judged before it decides anything.
 */
export async function industryVeto(
  d: Deployment,
  deps: CycleDeps,
  symbol: string,
  since: Date,
  now: Date,
): Promise<string | null> {
  const found = await shock(d, deps, symbol, since, 'buy');
  if (!found) return null;
  const why = `an industry-wide shock (${found.group}): ${found.reason}`;
  if (d.newsCheck?.industry === 'on') return why;
  logEvent(
    d,
    `Industry check (trial, not acted on): would have skipped buying ${symbol}, ${why}`,
    now,
  );
  return null;
}

/** A held stock's industry shock: a notice only (once a day per industry); the rules decide. */
export async function industryNotice(
  d: Deployment,
  deps: CycleDeps,
  symbol: string,
  since: Date,
  now: Date,
): Promise<void> {
  const found = await shock(d, deps, symbol, since, 'hold');
  const today = now.toISOString().slice(0, 10);
  if (!found || d.industryNoticed?.[found.group] === today) return;
  d.industryNoticed = { ...d.industryNoticed, [found.group]: today };
  const message = `Industry news for ${symbol} (${found.group}, notice only: the rules decide): ${found.reason}`;
  logEvent(d, message, now);
  await deps.notify(`${d.name}: ${message}`);
}
