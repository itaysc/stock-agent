import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { Category, Discovered } from '../../api/trade-types';
import { useIsMobile } from '../../hooks/useIsMobile';
import { money, pct } from '../../lib/format';
import { Sparkline } from '../shared/Sparkline';
import { StockCard } from '../shared/StockCard';

/** A category's stocks ranked by trend (the broker's momentum rule), with buttons to trade, watch or read the news. */
export function Discovery({
  onTrade,
  onWatch,
  onNews,
  onChart,
  watching,
}: {
  onTrade: (symbol: string) => void;
  /** Opens the large chart (clicking the small one). */
  onChart: (symbol: string) => void;
  onWatch: (symbol: string) => void;
  onNews: (symbol: string) => void;
  watching: string[];
}) {
  const mobile = useIsMobile();
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState('tech');
  const [data, setData] = useState<Discovered | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void api.tradeCategories().then(setCategories, () => undefined);
  }, []);
  useEffect(() => {
    setData(null);
    setError(null);
    void api.tradeDiscover(category).then(setData, (e: Error) => setError(e.message));
  }, [category]);
  return (
    <Paper p={mobile ? 0 : 'md'} withBorder={!mobile} bg={mobile ? 'transparent' : undefined}>
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={5}>Discover: trending now</Title>
          <Select
            size={mobile ? 'sm' : 'xs'}
            w={mobile ? '100%' : 200}
            value={category}
            onChange={(v) => v && setCategory(v)}
            data={categories.map((c) => ({ value: c.id, label: `${c.name} (${c.count})` }))}
            allowDeselect={false}
          />
        </Group>
        {error && <Alert color="red">{error}</Alert>}
        {!data && !error && <Loader size="sm" />}
        {data && mobile && (
          <Stack gap="sm">
            {data.items.map((t, i) => (
              <StockCard
                key={t.symbol}
                symbol={t.symbol}
                badge={
                  <Badge size="sm" variant="light" color={t.aboveTrend ? 'teal' : 'gray'}>
                    #{i + 1} · {t.aboveTrend ? 'rising' : 'below 200-day avg'}
                  </Badge>
                }
                price={t.price}
                changePct={t.momentumPct}
                changeNote="12 mo"
                stats={[
                  {
                    label: 'Last 3 months',
                    value: pct(t.threeMonthPct, true),
                    color: t.threeMonthPct >= 0 ? 'teal' : 'red',
                  },
                  { label: 'Swings a year', value: `${t.volatilityPct.toFixed(0)}%` },
                ]}
                spark={t.spark}
                onOpen={() => onChart(t.symbol)}
                actions={
                  <>
                    <Button size="sm" onClick={() => onTrade(t.symbol)}>
                      Trade
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      disabled={watching.includes(t.symbol)}
                      onClick={() => onWatch(t.symbol)}
                    >
                      {watching.includes(t.symbol) ? 'Watching' : 'Watch'}
                    </Button>
                    <Button size="sm" variant="light" onClick={() => onNews(t.symbol)}>
                      News
                    </Button>
                  </>
                }
              />
            ))}
          </Stack>
        )}
        {data && !mobile && (
          <ScrollArea>
            <Table highlightOnHover style={{ fontVariantNumeric: 'tabular-nums' }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>Stock</Table.Th>
                  <Table.Th ta="right">Price</Table.Th>
                  <Table.Th
                    ta="right"
                    title="Return over the last 12 months, leaving out the latest month (the broker's rule)"
                  >
                    12-month rise
                  </Table.Th>
                  <Table.Th ta="right">3 months</Table.Th>
                  <Table.Th>Trend</Table.Th>
                  <Table.Th ta="right" title="How much it swings in a year">
                    Swings
                  </Table.Th>
                  <Table.Th>Last 3 months</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.items.map((t, i) => (
                  <Table.Tr key={t.symbol}>
                    <Table.Td c="dimmed">{i + 1}</Table.Td>
                    <Table.Td fw={700}>{t.symbol}</Table.Td>
                    <Table.Td ta="right">{money(t.price)}</Table.Td>
                    <Table.Td ta="right" c={t.momentumPct >= 0 ? 'teal' : 'red'}>
                      {pct(t.momentumPct, true)}
                    </Table.Td>
                    <Table.Td ta="right" c={t.threeMonthPct >= 0 ? 'teal' : 'red'}>
                      {pct(t.threeMonthPct, true)}
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm" variant="light" color={t.aboveTrend ? 'teal' : 'gray'}>
                        {t.aboveTrend ? 'rising' : 'below 200-day avg'}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="right">{t.volatilityPct.toFixed(0)}%</Table.Td>
                    <Table.Td>
                      <Box
                        style={{ cursor: 'pointer' }}
                        onClick={() => onChart(t.symbol)}
                        title="Open the chart"
                      >
                        <Sparkline points={t.spark} />
                      </Box>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Button size="compact-xs" onClick={() => onTrade(t.symbol)}>
                          Trade
                        </Button>
                        <Button
                          size="compact-xs"
                          variant="default"
                          disabled={watching.includes(t.symbol)}
                          onClick={() => onWatch(t.symbol)}
                        >
                          Watch
                        </Button>
                        <Button size="compact-xs" variant="light" onClick={() => onNews(t.symbol)}>
                          News
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
        {data && (
          <Text size="xs" c="dimmed">
            {data.note}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
