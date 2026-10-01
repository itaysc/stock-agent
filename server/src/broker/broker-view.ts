import { deploymentEquity } from '../paper/deployment-cycle.js';
import type { Deployment, LedgerTrade } from '../paper/deployment.types.js';
import type { StrategyBar } from '../strategies/strategy.types.js';
import { openedAt, sellLevels } from './broker-levels.js';
import { holdingStatus, type Ranks } from './broker-status.js';
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
  const base = {
    algo: algoText(state.params),
    params: state.params,
    lastTune: state.lastTune,
    tested: TESTED,
    universe: [...BROKER_STOCKS, SAFE_ASSET],
  };
  if (!d) return { status: 'off' as const, ...base };
  const l = d.ledgers[0];
  const equity = deploymentEquity(d);
  const lastBuy = (symbol: string) =>
    l.trades.findLast((t) => t.symbol === symbol && t.side === 'buy');
  const holdings = Object.values(l.positions)
    .map((p) => {
      const price = l.lastPrices[p.symbol] ?? p.avgPrice;
      const opened = openedAt(l.trades, p.symbol);
      const safe = p.symbol === SAFE_ASSET;
      const auto = sellLevels(
        history[p.symbol] ?? [],
        opened,
        p.avgPrice,
        safe ? {} : d.sleeves[0].params,
      );
      const status = holdingStatus({
        symbol: p.symbol,
        price,
        autoStop: auto.stopPrice,
        autoTake: auto.takeProfitPrice,
        manual: d.manual?.[p.symbol],
        ranks,
        selling: l.pending.some(
          (o) => o.symbol === p.symbol && o.side === 'sell',
        ),
        safe,
      });
      return {
        symbol: p.symbol,
        qty: p.qty,
        boughtAt: opened,
        entryPrice: p.avgPrice,
        price,
        highSinceBuy: auto.highSinceBuy,
        autoStopPrice: auto.stopPrice,
        ...status,
        value: p.qty * price,
        weightPct: ((p.qty * price) / equity) * 100,
        gainPct: (price / p.avgPrice - 1) * 100,
        why: plainReason(lastBuy(p.symbol)?.reason),
      };
    })
    .sort((a, b) => b.value - a.value);
  const planned = [
    ...(l.staged ?? []).map((s) => ({
      side: 'buy' as const,
      symbol: s.symbol,
      qty: s.qty,
      why: plainReason(s.reason),
      when: 'at the next open, after the news check',
    })),
    ...l.pending.map((o) => ({
      side: o.side,
      symbol: o.symbol,
      qty: o.qty,
      why: plainReason(o.reason),
      when: 'sent, waiting to fill',
    })),
  ];
  const activity = [
    ...l.trades.map((t) => ({
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
    startedAt: d.createdAt,
    capital: d.capital,
    equity,
    cash: l.cash,
    pnl: equity - d.capital,
    pnlPct: (equity / d.capital - 1) * 100,
    spyPct,
    maxDrawdownPct: d.maxDrawdownPct,
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
