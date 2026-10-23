import { Text } from '@mantine/core';
import type { MyPosition } from '../../api/trade-types';
import { money, shekels, timeAgo } from '../../lib/format';
import type { LivePrices } from '../../lib/live';
import { type CardStat, StockCard } from '../shared/StockCard';
import { type MyAction, MyStockMenu } from './MyStockMenu';

const shares = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(4));
const signed = (n: number) => `${n >= 0 ? '+' : '-'}${money(Math.abs(n))}`;

/** One of your stocks on a phone: the same facts as its table row, as a card. */
export function MyStockCard({
  p,
  live,
  onAction,
}: {
  p: MyPosition;
  live: LivePrices;
  onAction: (p: MyPosition, a: MyAction) => void;
}) {
  const price = live[p.symbol]?.price ?? p.lastClose ?? p.avgPrice;
  const at = live[p.symbol]?.at;
  const gain = (price - p.avgPrice) * p.qty;
  const stats: CardStat[] = [
    {
      label: 'Bought at',
      value: (
        <>
          {money(p.avgPrice)}
          {p.openedAt && (
            <Text span size="xs" c="dimmed">
              {' '}
              · {new Date(p.openedAt).toLocaleDateString()}
            </Text>
          )}
        </>
      ),
    },
    { label: 'Worth now', value: money(price * p.qty) },
    {
      label: 'Paid',
      value: (
        <>
          {money(p.paidUsd)}
          {p.paidIls !== null && (
            <Text span size="xs" c="dimmed">
              {' '}
              · {shekels(p.paidIls)}
            </Text>
          )}
        </>
      ),
    },
    { label: 'Gain', value: signed(gain), color: gain >= 0 ? 'teal' : 'red' },
  ];
  if (p.levels?.stopPrice)
    stats.push({ label: 'Your stop', value: money(p.levels.stopPrice), color: 'red' });
  if (p.levels?.takeProfitPrice)
    stats.push({ label: 'Your target', value: money(p.levels.takeProfitPrice), color: 'teal' });
  return (
    <StockCard
      symbol={p.symbol}
      subtitle={`${shares(p.qty)} shares · ${at ? `price ${timeAgo(at)}` : 'last close'}`}
      price={price}
      changePct={(price / p.avgPrice - 1) * 100}
      stats={stats}
      spark={p.spark}
      entryPrice={p.avgPrice}
      boughtAt={p.openedAt}
      onOpen={() => onAction(p, 'chart')}
      menu={<MyStockMenu p={p} onAction={onAction} />}
    />
  );
}
