import type { brokerView } from './broker-view.js';

type View = Exclude<ReturnType<typeof brokerView>, { status: 'off' }>;
const money = (n: number) =>
  `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const signed = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

/** The daily Telegram message: what it did since the last one, what it holds, how it does vs SPY. */
export function dailyReport(v: View, since: Date | null): string {
  const fresh = v.activity
    .filter((a) => !since || new Date(a.timestamp) > since)
    .reverse();
  const trades = fresh.filter((a) => a.kind !== 'note');
  const notes = fresh.filter((a) => a.kind === 'note');
  const lines = [
    `📊 Broker: ${money(v.equity)} (${signed(v.pnlPct)} since start${v.spyPct === null ? '' : `; SPY ${signed(v.spyPct)}`})`,
    v.status === 'active'
      ? ''
      : `⏸ ${v.status}${v.statusReason ? `: ${v.statusReason}` : ''}`,
    trades.length ? 'Done:' : 'No trades since the last report.',
    ...trades.map((t) => `• ${t.text}`),
    ...(v.planned.length
      ? [
          'Next:',
          ...v.planned.map(
            (p) =>
              `• ${p.side === 'buy' ? 'Buy' : 'Sell'} ${p.qty} ${p.symbol} ${p.when}${p.why ? `: ${p.why}` : ''}`,
          ),
        ]
      : []),
    ...(notes.length
      ? ['Notes:', ...notes.slice(-5).map((n) => `• ${n.text}`)]
      : []),
    v.holdings.length
      ? `Holds: ${v.holdings.map((h) => `${h.symbol} ${h.weightPct.toFixed(0)}% (${signed(h.gainPct)})`).join(', ')}; cash ${money(v.cash)}`
      : `Holds: nothing yet; cash ${money(v.cash)}`,
    'Paper money. /status any time, /pause to stop trading.',
  ];
  return lines.filter(Boolean).join('\n');
}
