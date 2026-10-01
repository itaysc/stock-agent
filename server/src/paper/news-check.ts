import { type CycleDeps, logEvent } from './deployment-events.js';
import type { Deployment, StagedBuy } from './deployment.types.js';
import { assessNews } from './news-assess.js';

const STAGED_MAX_MS = 4 * 86_400_000;
const WATCH_START_MS = 3_600_000;

/**
 * Sends the buys that waited for the pre-open check, unless the news or the
 * official facts since the signal say otherwise. Runs when the market opens
 * soon (or is open).
 */
export async function releaseStaged(
  d: Deployment,
  deps: CycleDeps,
  now: Date,
  send: (i: number, buy: StagedBuy) => Promise<void>,
): Promise<void> {
  const any = d.ledgers.some((l) => l.staged?.length);
  if (
    !any ||
    d.status !== 'active' ||
    !d.newsCheck ||
    !(await deps.opensSoon())
  )
    return;
  for (const [i, ledger] of d.ledgers.entries()) {
    const staged = ledger.staged ?? [];
    ledger.staged = [];
    for (const buy of staged) {
      if (now.getTime() - new Date(buy.signalAt).getTime() > STAGED_MAX_MS) {
        logEvent(
          d,
          `Dropped the buy of ${buy.symbol}: its signal is more than 4 days old`,
          now,
        );
        continue;
      }
      const veto = await assessNews(
        d.newsCheck,
        deps,
        buy.symbol,
        new Date(buy.signalAt),
        'buy',
      );
      if (veto) {
        logEvent(d, `Skipped buying ${buy.qty} ${buy.symbol}: ${veto}`, now);
        continue;
      }
      await send(i, buy);
    }
  }
}

/**
 * Watches held symbols (every cycle): a halt, a severe filing, or severe news
 * the AI (if on) confirms is logged and notified; with watch=sell the position
 * is sold. Returns the positions to sell.
 */
export async function watchHeld(
  d: Deployment,
  deps: CycleDeps,
  now: Date,
): Promise<
  Array<{ sleeve: number; symbol: string; qty: number; why: string }>
> {
  const check = d.newsCheck;
  const since = d.newsCheckedAt
    ? new Date(d.newsCheckedAt)
    : new Date(now.getTime() - WATCH_START_MS);
  d.newsCheckedAt = now;
  if (!check || check.watch === 'off' || d.status === 'stopped') return [];
  const sells: Array<{
    sleeve: number;
    symbol: string;
    qty: number;
    why: string;
  }> = [];
  for (const [i, ledger] of d.ledgers.entries()) {
    for (const p of Object.values(ledger.positions)) {
      const why = await assessNews(check, deps, p.symbol, since, 'hold');
      if (!why) continue;
      const message = `Breaking news on ${p.symbol} (held: ${p.qty}): ${why}${check.watch === 'sell' ? '. Selling it.' : ''}`;
      logEvent(d, message, now);
      await deps.notify(`${d.name}: ${message}`);
      if (check.watch === 'sell')
        sells.push({
          sleeve: i,
          symbol: p.symbol,
          qty: p.qty,
          why: 'breaking news',
        });
    }
  }
  return sells;
}
