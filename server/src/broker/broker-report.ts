import type { LedgerTrade } from '../paper/deployment.types.js';
import type { brokerView } from './broker-view.js';
import { plainReason } from './broker-view.js';
import { SAFE_ASSET } from './universe.js';

type View = Exclude<ReturnType<typeof brokerView>, { status: 'off' }>;
const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
const signedUsd = (n: number) => `${n >= 0 ? '+' : '-'}${money(Math.abs(n))}`;
const shares = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(4));
const TONE = { good: '🟢', watch: '🟠', danger: '🔴', neutral: '⚪' } as const;

/** A message the moment an order fills: what, how much, at what price, why, and its stop or result. */
export function fillMessage(t: LedgerTrade, stopPct: number): string {
  const total = t.qty * t.price;
  const why = plainReason(t.reason);
  if (t.side === 'buy' && t.symbol === SAFE_ASSET)
    return `🅿️ Parked ${money(total)} in T-bills (${SAFE_ASSET}) at ${money(t.price)}: too few stocks are rising.`;
  if (t.side === 'buy')
    return [
      `✅ Bought ${shares(t.qty)} ${t.symbol} at ${money(t.price)} = ${money(total)}`,
      why && `Why: ${why}`,
      stopPct > 0 &&
        `Stop loss: sells if it closes below ${money(t.price * (1 - stopPct / 100))} (${stopPct}% under its highest close; it rises with the price).`,
    ]
      .filter(Boolean)
      .join('\n');
  const pnl = t.realizedPnl ?? 0;
  const cost = total - pnl;
  const pct = cost > 0 ? (pnl / cost) * 100 : 0;
  return [
    `${pnl >= 0 ? '💰' : '🔻'} Sold ${shares(t.qty)} ${t.symbol} at ${money(t.price)} = ${money(total)} · ${pnl >= 0 ? 'profit' : 'loss'} ${signedUsd(pnl)} (${signed(pct)})`,
    why && `Why: ${why}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** One holding in the daily update. */
function holdingLines(h: View['holdings'][number]): string[] {
  if (h.symbol === SAFE_ASSET)
    return [
      `⚪ ${h.symbol} (T-bills) · ${money(h.value)}: waiting until more stocks rise`,
    ];
  const pnl = h.qty * (h.price - h.entryPrice);
  const sells = [
    h.stopPrice !== null &&
      `sells below ${money(h.stopPrice)}${h.stopIsYours ? ' (your stop)' : ''}`,
    h.takeProfitPrice !== null &&
      `or above ${money(h.takeProfitPrice)}${h.takeIsYours ? ' (your target)' : ''}`,
  ].filter(Boolean);
  return [
    `${TONE[h.tone]} ${h.symbol} · ${money(h.price)} (bought ${money(h.entryPrice)}) · ${signed(h.gainPct)} (${signedUsd(pnl)})`,
    `   ${h.label}${h.rank !== null ? ` #${h.rank}` : ''}${sells.length ? ` · ${sells.join(' ')}` : ''}`,
    ...(h.label === 'Strong' || h.label === 'Holding' ? [] : [`   ${h.text}`]),
  ];
}

/** The daily update: value vs SPY, each stock's status, what it did, and what it will do at the next open. */
export function dailyReport(v: View, since: Date | null): string {
  const fresh = v.activity
    .filter((a) => !since || new Date(a.timestamp) > since)
    .reverse();
  const trades = fresh.filter((a) => a.kind !== 'note');
  const notes = fresh.filter((a) => a.kind === 'note');
  const lines = [
    `📊 Broker update: worth ${money(v.equity)} (${signed(v.pnlPct)}, ${signedUsd(v.pnl)} since start${v.spyPct === null ? '' : ` · SPY ${signed(v.spyPct)}`}) · cash ${money(v.cash)}`,
    v.status === 'active'
      ? ''
      : `⏸ ${v.status}${v.statusReason ? `: ${v.statusReason}` : ''}`,
    '',
    ...(v.holdings.length
      ? ['Your stocks:', ...v.holdings.flatMap(holdingLines)]
      : ['Holds nothing yet.']),
    ...(trades.length
      ? ['', 'Done since the last update:', ...trades.map((t) => `• ${t.text}`)]
      : []),
    ...(v.planned.length
      ? [
          '',
          'At the next open:',
          ...v.planned.map(
            (p) =>
              `• ${p.side === 'buy' ? 'Buy' : 'Sell'} ${shares(p.qty)} ${p.symbol}${p.why ? `: ${p.why}` : ''}`,
          ),
        ]
      : []),
    ...(notes.length
      ? ['', 'Notes:', ...notes.slice(-5).map((n) => `• ${n.text}`)]
      : []),
    '',
    'Paper money. /status any time · /pause to stop trading · the web app to sell or set your own stop.',
  ];
  return lines
    .filter(
      (l, i, all) =>
        l !== '' || (i > 0 && all[i - 1] !== '' && i < all.length - 1),
    )
    .join('\n');
}
