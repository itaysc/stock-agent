import { Button, Center, Loader, Modal, Paper, Stack, Table, Text, Title } from '@mantine/core';
import { IconChartLine } from '@tabler/icons-react';
import { lazy, Suspense, useState } from 'react';
import type { BrokerHolding, BrokerPlanned } from '../../api/broker-types';
import { money, pct, tone } from '../../lib/format';
import { SellRules } from './SellRules';

// The chart library is big: load it when a chart is opened.
const StockChart = lazy(() => import('./StockChart').then((m) => ({ default: m.StockChart })));

const usd = (n: number | null) => (n === null ? '—' : `$${n.toFixed(2)}`);
const shares = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(4));

/** What it holds: buy price, now, the price it sells at, and a chart for each. */
export function BrokerHoldings({
  holdings,
  planned,
  params,
}: {
  holdings: BrokerHolding[];
  planned: BrokerPlanned[];
  params: Record<string, string>;
}) {
  const [chart, setChart] = useState<string | null>(null);
  return (
    <Paper p="md" withBorder>
      <Stack gap="sm">
        <Title order={5}>What you're invested in</Title>
        {holdings.length ? (
          <Table.ScrollContainer minWidth={760}>
            <Table verticalSpacing={6} highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Stock</Table.Th>
                  <Table.Th ta="right">Shares</Table.Th>
                  <Table.Th ta="right">Bought at</Table.Th>
                  <Table.Th ta="right">Now</Table.Th>
                  <Table.Th ta="right">Gain</Table.Th>
                  <Table.Th ta="right">Sells below</Table.Th>
                  <Table.Th ta="right">Value</Table.Th>
                  <Table.Th>Why it holds it</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {holdings.map((h) => (
                  <Table.Tr
                    key={h.symbol}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setChart(h.symbol)}
                  >
                    <Table.Td fw={600}>{h.symbol}</Table.Td>
                    <Table.Td ta="right">{shares(h.qty)}</Table.Td>
                    <Table.Td ta="right">
                      {usd(h.entryPrice)}
                      {h.boughtAt && (
                        <Text size="xs" c="dimmed">
                          {new Date(h.boughtAt).toLocaleDateString()}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td ta="right">{usd(h.price)}</Table.Td>
                    <Table.Td ta="right" c={tone(h.gainPct)}>
                      {pct(h.gainPct)}
                    </Table.Td>
                    <Table.Td ta="right" c="red">
                      {usd(h.stopPrice)}
                      {h.takeProfitPrice !== null && (
                        <Text size="xs" c="teal">
                          or above {usd(h.takeProfitPrice)}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td ta="right">
                      {money(h.value)}
                      <Text size="xs" c="dimmed">
                        {h.weightPct.toFixed(0)}%
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {h.why || '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        leftSection={<IconChartLine size={14} />}
                      >
                        Chart
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        ) : (
          <Text size="sm" c="dimmed">
            Nothing yet: it buys at the next market open.
          </Text>
        )}
        {planned.length > 0 && (
          <>
            <Title order={6}>Next</Title>
            {planned.map((p, i) => (
              <Text key={i} size="sm">
                {p.side === 'buy' ? '🟢 Buy' : '🔴 Sell'} {shares(p.qty)} {p.symbol} {p.when}
                {p.why && (
                  <Text span c="dimmed">
                    {' '}
                    · {p.why}
                  </Text>
                )}
              </Text>
            ))}
          </>
        )}
        <SellRules params={params} />
      </Stack>
      <Modal opened={!!chart} onClose={() => setChart(null)} title={chart} size="xl">
        {chart && (
          <Suspense
            fallback={
              <Center h={320}>
                <Loader />
              </Center>
            }
          >
            <StockChart symbol={chart} />
          </Suspense>
        )}
      </Modal>
    </Paper>
  );
}
