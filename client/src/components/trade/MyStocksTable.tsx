import {
  Anchor,
  Badge,
  Button,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { useState } from 'react';
import type { MyPosition, MyStocksView } from '../../api/trade-types';
import { money, pct, shekels, timeAgo } from '../../lib/format';
import type { LivePrices } from '../../lib/live';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Sparkline } from '../shared/Sparkline';
import { MyStockCard } from './MyStockCard';
import { type MyAction, MyStockMenu } from './MyStockMenu';

export type { MyAction };
const shares = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(4));

/** Your own stocks: what you paid, the price now (live), the gain, the trend since the buy, and actions. */
export function MyStocksTable({
  view,
  live,
  onAction,
  onSync,
  syncing,
}: {
  view: MyStocksView;
  live: LivePrices;
  onAction: (p: MyPosition, a: MyAction) => void;
  /** Match this list to the Alpaca account (stocks bought or sold outside the app). */
  onSync: () => void;
  syncing: boolean;
}) {
  const mobile = useIsMobile();
  const [allEvents, setAllEvents] = useState(false);
  const now = (p: MyPosition) => live[p.symbol]?.price ?? p.lastClose ?? p.avgPrice;
  const events = view.events.slice(0, allEvents ? 30 : mobile ? 3 : 5);
  return (
    // On a phone the cards are the boxes: no frame around them.
    <Paper p={mobile ? 0 : 'md'} withBorder={!mobile} bg={mobile ? 'transparent' : undefined}>
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={5}>My stocks</Title>
          <Button
            size={mobile ? 'sm' : 'xs'}
            variant="light"
            leftSection={<IconRefresh size={14} />}
            loading={syncing}
            onClick={onSync}
            title="Adds stocks bought outside the app, lowers ones sold outside it, and follows open orders placed there"
          >
            Sync Data
          </Button>
        </Group>
        {view.positions.length && mobile ? (
          <Stack gap="sm">
            {view.positions.map((p) => (
              <MyStockCard key={p.symbol} p={p} live={live} onAction={onAction} />
            ))}
          </Stack>
        ) : view.positions.length ? (
          <ScrollArea>
            <Table highlightOnHover style={{ fontVariantNumeric: 'tabular-nums' }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Stock</Table.Th>
                  <Table.Th ta="right">Shares</Table.Th>
                  <Table.Th ta="right">Bought at</Table.Th>
                  <Table.Th
                    ta="right"
                    title="What you paid for the shares you hold; in shekels at each buy day's Bank of Israel rate"
                  >
                    Paid
                  </Table.Th>
                  <Table.Th ta="right">Now</Table.Th>
                  <Table.Th ta="right">Gain</Table.Th>
                  <Table.Th>Since buy</Table.Th>
                  <Table.Th>Your levels</Table.Th>
                  <Table.Th ta="right">Value</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {view.positions.map((p) => {
                  const price = now(p);
                  const gain = (price - p.avgPrice) * p.qty;
                  const at = live[p.symbol]?.at;
                  return (
                    <Table.Tr
                      key={p.symbol}
                      style={{ cursor: 'pointer' }}
                      onClick={() => onAction(p, 'chart')}
                    >
                      <Table.Td fw={700}>{p.symbol}</Table.Td>
                      <Table.Td ta="right">{shares(p.qty)}</Table.Td>
                      <Table.Td ta="right">
                        {money(p.avgPrice)}
                        {p.openedAt && (
                          <Text size="xs" c="dimmed">
                            {new Date(p.openedAt).toLocaleDateString()}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td ta="right">
                        {money(p.paidUsd)}
                        {p.paidIls !== null && (
                          <Text size="xs" c="dimmed">
                            {shekels(p.paidIls)}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td ta="right">
                        {money(price)}
                        <Text size="xs" c="dimmed">
                          {at ? timeAgo(at) : 'last close'}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right" c={gain >= 0 ? 'teal' : 'red'}>
                        {gain >= 0 ? '+' : '-'}
                        {money(Math.abs(gain))}
                        <Text size="xs">{pct((price / p.avgPrice - 1) * 100)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Sparkline points={p.spark} entryPrice={p.avgPrice} boughtAt={p.openedAt} />
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="red">
                          {p.levels?.stopPrice ? `stop ${money(p.levels.stopPrice)}` : ''}
                        </Text>
                        <Text size="xs" c="teal">
                          {p.levels?.takeProfitPrice
                            ? `target ${money(p.levels.takeProfitPrice)}`
                            : ''}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">{money(price * p.qty)}</Table.Td>
                      <Table.Td onClick={(e) => e.stopPropagation()}>
                        <MyStockMenu p={p} onAction={onAction} />
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        ) : (
          <Text size="sm" c="dimmed">
            Nothing yet: search a stock above and buy an amount.
          </Text>
        )}
        {view.pending.map((o) => (
          <Badge key={o.clientOrderId} variant="light" color="yellow" w="fit-content">
            Waiting: {o.side} {o.notional ? money(o.notional) : shares(o.qty)} {o.symbol} (sent{' '}
            {timeAgo(o.submittedAt)})
          </Badge>
        ))}
        {events.map((e) => (
          <Text key={e.timestamp + e.message} size="xs" c="dimmed">
            {new Date(e.timestamp).toLocaleString()}: {e.message}
          </Text>
        ))}
        {view.events.length > events.length && (
          <Anchor size="xs" component="button" onClick={() => setAllEvents(true)} w="fit-content">
            Show more history
          </Anchor>
        )}
      </Stack>
    </Paper>
  );
}
