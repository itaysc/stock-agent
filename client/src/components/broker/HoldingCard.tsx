import { Badge } from '@mantine/core';
import type { BrokerHolding } from '../../api/broker-types';
import { money } from '../../lib/format';
import { when } from '../../lib/when';
import { type CardStat, StockCard } from '../shared/StockCard';
import { type HoldingAction, HoldingActions } from './HoldingActions';

const usd = (n: number | null) => (n === null ? '—' : `$${n.toFixed(2)}`);
const shares = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(4));
const TONE = { good: 'teal', watch: 'orange', danger: 'red', neutral: 'gray' } as const;

/** One holding on a phone: the same facts as its table row (HoldingRow), as a card. */
export function HoldingCard({
  h,
  onAction,
}: {
  h: BrokerHolding;
  onAction: (action: HoldingAction) => void;
}) {
  const yours = h.stopIsYours || h.takeIsYours ? ' (yours)' : '';
  const stats: CardStat[] = [
    {
      label: 'Bought at',
      value: `${usd(h.entryPrice)}${h.boughtAt ? ` · ${new Date(h.boughtAt).toLocaleDateString()}` : ''}`,
    },
    { label: 'Worth now', value: `${money(h.value)} · ${h.weightPct.toFixed(0)}%` },
    { label: `Sells below${yours}`, value: usd(h.stopPrice), color: 'red' },
  ];
  if (h.takeProfitPrice !== null)
    stats.push({ label: `Sells above${yours}`, value: usd(h.takeProfitPrice), color: 'teal' });
  return (
    <StockCard
      symbol={h.symbol}
      badge={
        <Badge size="sm" variant="light" color={TONE[h.tone]}>
          {h.label}
          {h.rank !== null && h.label !== 'Parked' ? ` · #${h.rank}` : ''}
        </Badge>
      }
      subtitle={`${shares(h.qty)} shares · ${h.liveAt ? `price ${when(h.liveAt)}` : 'last close'}`}
      price={h.price}
      changePct={h.gainPct}
      stats={stats}
      note={h.text}
      spark={h.spark ?? []}
      entryPrice={h.entryPrice}
      boughtAt={h.boughtAt}
      onOpen={() => onAction('chart')}
      menu={<HoldingActions holding={h} onAction={onAction} />}
    />
  );
}
