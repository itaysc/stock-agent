import { deploymentEquity } from '../paper/deployment-cycle.js';
import type { Deployment, LedgerTrade } from '../paper/deployment.types.js';
import type { StrategyBar } from '../strategies/strategy.types.js';
import { brokerHoldings } from './broker-holdings.js';
import { dailyResults } from './broker-daily.js';
import { PROFILE_ROBUSTNESS } from './profile-robustness.data.js';
import { PROFILE_STATS } from './profile-stats.data.js';
import { profileById } from './profiles.js';
import type { Ranks } from './broker-status.js';
import type { BrokerState } from './broker.types.js';
import { algoText, BROKER_STOCKS, SAFE_ASSET, TESTED } from './universe.js';

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

/** "rank 1: +85.2% over 252 bars" → "#1 of 50: up 85.2% in 12 months". */
export function plainReason(reason: string | undefined): string {
  if (!reason) return '';
  return reason
    .replace(
      /^rank (\d+): ([+-][\d.]+)% over (\d+) bars/,
      (_, rank: string, pct: string, bars: string) =>
        `#${rank} of ${BROKER_STOCKS.length}: ${pct.startsWith('-') ? 'down' : 'up'} ${pct.slice(1)}% in ${Math.max(1, Math.round(Number(bars) / 21))} months`,
    )
    .replace(/^left the top (\d+)$/, 'dropped out of the top $1')
    .replace(
      /^stop: down ([\d.]+)% from its high$/,
      'stop loss: fell $1% from its high since the buy',
    )
    .replace(
      /^safe asset for (\d+) empty slots?$/,
      'parked in T-bills: too few stocks rising',
    );
}

export function tradeText(
  t: Pick<
    LedgerTrade,
    'side' | 'qty' | 'symbol' | 'price' | 'reason' | 'realizedPnl'
  >,
): string {
  const pnl =
    t.side === 'sell' && t.realizedPnl !== undefined
      ? ` (${t.realizedPnl >= 0 ? 'profit' : 'loss'} ${money(Math.abs(t.realizedPnl))})`
      : '';
  const why = plainReason(t.reason);
  return `${t.side === 'buy' ? 'Bought' : 'Sold'} ${t.qty} ${t.symbol} at $${t.price.toFixed(2)}${pnl}${why ? `: ${why}` : ''}`;
}

/** Everything the Broker page shows. */
export function brokerView(
  d: Deployment | null,
  state: BrokerState,
  spyPct: number | null,
  /** Daily bars of the held symbols since they were bought (for the stop levels). */
  history: Record<string, StrategyBar[]> = {},
  /** Each stock's rank now (for the status); null when it could not be computed. */
  ranks: Ranks | null = null,
) {
  const profile = profileById(
    d?.source.profile ?? state.profile ?? 'aggressive',
  );
  const base = {
    profile: profile && {
      id: profile.id,
      name: profile.name,
      summary: profile.summary,
      alertPct: profile.alertPct,
    },
    profileStats: (profile && PROFILE_STATS.profiles[profile.id]) ?? null,
    // The honest range: the same test with the re-rank day moved and random stocks left out.
    profileRobust: (profile && PROFILE_ROBUSTNESS.profiles[profile.id]) ?? null,
    // This investment's own settings (the stocks part), or the latest ones before any.
    algo: algoText(d?.sleeves[0]?.params ?? state.params),
    params: d?.sleeves[0]?.params ?? state.params,
    lastTune: state.lastTune,
    tested: TESTED,
    universe: [...BROKER_STOCKS, SAFE_ASSET],
  };
  if (!d) return { status: 'off' as const, ...base };
  const equity = deploymentEquity(d);
  const holdings = brokerHoldings(d, equity, history, ranks);
  const all = <T>(pick: (l: Deployment['ledgers'][number]) => T[]) =>
    d.ledgers.flatMap(pick);
  const planned = [
    ...all((l) => l.staged ?? []).map((s) => ({
      side: 'buy' as const,
      symbol: s.symbol,
      qty: s.qty,
      why: plainReason(s.reason),
      when: s.waitFor
        ? `after its earnings report on ${s.waitFor} (if the report is fine)`
        : 'at the next open, after the news check',
    })),
    ...all((l) => l.pending).map((o) => ({
      side: o.side,
      symbol: o.symbol,
      qty: o.qty,
      why: plainReason(o.reason),
      when: 'sent, waiting to fill',
    })),
  ];
  const activity = [
    ...all((l) => l.trades).map((t) => ({
      timestamp: t.timestamp,
      kind: t.side,
      text: tradeText(t),
    })),
    ...d.events
      .filter((e) => !/^(Bought|Sold|Sent |Buy \d)/.test(e.message))
      .map((e) => ({
        timestamp: e.timestamp,
        kind: 'note' as const,
        text: e.message,
      })),
  ]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, 40);
  return {
    status: d.status,
    statusReason: d.statusReason,
    deploymentId: d.id,
    name: d.name,
    startedAt: d.createdAt,
    /** The trading day of the latest closing prices it used (null before the first). */
    closesAsOf: d.lastBarAt,
    /** Each trading day's result (the calendar on the page). */
    daily: dailyResults(d),
    capital: d.capital,
    equity,
    cash: d.ledgers.reduce((n, l) => n + l.cash, 0),
    pnl: equity - d.capital,
    pnlPct: (equity / d.capital - 1) * 100,
    spyPct,
    maxDrawdownPct: d.maxDrawdownPct,
    /** It asks you in Telegram past this drop (instead of selling by itself). */
    alertPct: d.drawdownAlert?.pct ?? null,
    expectation: d.expectation,
    holdings,
    planned,
    /** Stocks you sold: it does not buy them again before these dates. */
    noBuyUntil: Object.entries(d.noBuyUntil ?? {})
      .filter(([, until]) => new Date(until) > new Date())
      .map(([symbol, until]) => ({ symbol, until })),
    activity,
    ...base,
  };
}
